package ai.trustlens.floatingassist

import android.graphics.BitmapFactory
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * On-device OCR so floating analyze can attach readable caption context
 * alongside the uploaded screenshot (vision still primary).
 */
object ScreenTextExtractor {
  private const val TAG = "TLOcr"
  private const val TIMEOUT_MS = 12_000L

  private val chromeLine =
    Regex(
      """(?ix)^(
        facebook|messenger|home|watch|marketplace|notifications|menu|
        like|comment|share|send|save|follow|following|friends|reels|
        suggested\s+for\s+you|sponsored|see\s+translation|see\s+more|
        write\s+a\s+comment|what.?s\s+on\s+your\s*mind|
        just\s+now|\d+\s*(m|h|d|w|min|mins|hr|hrs|hour|hours|day|days)\s*ago|
        \d+[.,]?\d*\s*[kmb]?\s*(likes?|comments?|shares?)|
        trustlens|analyzing|quick\s+check
      )$""",
    )

  fun extract(imagePath: String): String {
    val file = File(imagePath)
    if (!file.exists() || file.length() < 64) return ""

    return try {
      val bitmap =
        BitmapFactory.decodeFile(file.absolutePath)
          ?: return ""
      try {
        recognize(bitmap)
      } finally {
        if (!bitmap.isRecycled) bitmap.recycle()
      }
    } catch (e: Exception) {
      Log.w(TAG, "OCR failed: ${e.message}")
      ""
    }
  }

  private fun recognize(bitmap: android.graphics.Bitmap): String {
    val image = InputImage.fromBitmap(bitmap, 0)
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    val latch = CountDownLatch(1)
    val out = AtomicReference("")
    val err = AtomicReference<Exception?>(null)

    recognizer
      .process(image)
      .addOnSuccessListener { visionText ->
        out.set(cleanOcr(visionText.text.orEmpty()))
        latch.countDown()
      }
      .addOnFailureListener { e ->
        err.set(e)
        latch.countDown()
      }

    val ok = latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS)
    try {
      recognizer.close()
    } catch (_: Exception) {
    }

    if (!ok) {
      Log.w(TAG, "OCR timed out")
      return ""
    }
    err.get()?.let { Log.w(TAG, "OCR error", it) }
    val text = out.get()
    Log.i(TAG, "OCR chars=${text.length}")
    return text
  }

  /** Drop status-bar junk and common Facebook chrome; keep post body. */
  private fun cleanOcr(raw: String): String {
    return raw
      .lines()
      .map { it.trim() }
      .filter { line ->
        if (line.isEmpty()) return@filter false
        if (line.length <= 1) return@filter false
        if (line.matches(Regex("""^[\d:./%°·•]+$"""))) return@filter false
        if (chromeLine.matches(line)) return@filter false
        // Pure reaction / count rows
        if (line.matches(Regex("""(?i)^[\d.,kmb\s]+(likes?|comments?|shares?)?$"""))) return@filter false
        true
      }
      .joinToString("\n")
      .trim()
      .take(4500)
  }
}
