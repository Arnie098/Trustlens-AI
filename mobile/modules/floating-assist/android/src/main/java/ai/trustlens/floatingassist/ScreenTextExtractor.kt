package ai.trustlens.floatingassist

import android.graphics.Bitmap
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
 * On-device OCR for floating analyze caption context.
 * Crops status bar / bottom nav, strips FB chrome so we do not feed
 * "11:10 PM / 15+ / 2.8K" junk into the model or the card.
 */
object ScreenTextExtractor {
  private const val TAG = "TLOcr"
  private const val TIMEOUT_MS = 12_000L

  private val chromeExact =
    Regex(
      """(?ix)^(
        facebook|messenger|home|watch|marketplace|notifications|menu|
        like|comment|share|send|save|follow|following|friends|reels|
        suggested\s+for\s+you|sponsored|see\s+translation|see\s+more|
        write\s+a\s+comment|what.?s\s+on\s+your\s*mind|
        just\s+now|live|public|friends?\s+only|
        trustlens|analyzing|quick\s+check|needs\s+verification
      )$""",
    )

  /** Clock / battery / signal style lines */
  private val statusBar =
    Regex(
      """(?ix)^(
        \d{1,2}:\d{2}(\s*[ap]m)?.* |          # 11:10 PM …
        \d{1,2}\s*[ap]\.?m\.? |                 # 11 PM
        \d{1,2}\+ |                             # 15+
        [\d.,]+\s*[kmb](\s*[a-z0-9]*)? |        # 2.8K Q 57
        [\d.,kmb\s]+(likes?|comments?|shares?|views?)? |
        (all|lte|4g|5g|wifi|volte|vo)\b.* |
        \d{1,3}% |
        [·•|]+
      )$""",
    )

  fun extract(imagePath: String): String {
    val file = File(imagePath)
    if (!file.exists() || file.length() < 64) return ""

    return try {
      val full =
        BitmapFactory.decodeFile(file.absolutePath)
          ?: return ""
      try {
        // Skip top status bar + bottom nav for OCR only (full image still uploaded for vision)
        val cropped = cropContentBand(full)
        try {
          recognize(cropped)
        } finally {
          if (cropped !== full && !cropped.isRecycled) cropped.recycle()
        }
      } finally {
        if (!full.isRecycled) full.recycle()
      }
    } catch (e: Exception) {
      Log.w(TAG, "OCR failed: ${e.message}")
      ""
    }
  }

  /** Keep middle ~78% of the frame (drop status + gesture bar). */
  private fun cropContentBand(src: Bitmap): Bitmap {
    val w = src.width
    val h = src.height
    if (w < 32 || h < 64) return src
    val top = (h * 0.09f).toInt().coerceAtLeast(1)
    val bottomPad = (h * 0.12f).toInt().coerceAtLeast(1)
    val ch = (h - top - bottomPad).coerceAtLeast(h / 2)
    return try {
      Bitmap.createBitmap(src, 0, top, w, ch)
    } catch (_: Exception) {
      src
    }
  }

  private fun recognize(bitmap: Bitmap): String {
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

  private fun cleanOcr(raw: String): String {
    val kept =
      raw
        .lines()
        .map { it.trim() }
        .filter { line -> keepLine(line) }

    // Need real words, not pure stats
    val letterCount = kept.joinToString("").count { it.isLetter() }
    if (letterCount < 24) {
      Log.i(TAG, "OCR discarded (only chrome/stats, letters=$letterCount)")
      return ""
    }

    return kept.joinToString("\n").trim().take(4500)
  }

  private fun keepLine(line: String): Boolean {
    if (line.isEmpty() || line.length <= 1) return false
    if (line.matches(Regex("""^[\d:./%°·•+\s]+$"""))) return false
    if (chromeExact.matches(line)) return false
    if (statusBar.matches(line)) return false
    // "2.8K Q 57" style mixed junk
    if (line.matches(Regex("""(?i)^[\d.,kmb+\s]+[a-z]{0,3}(\s+[\d.,kmb+\s]+)*$"""))) return false
    // Mostly non-letters
    val letters = line.count { it.isLetter() }
    if (letters < 3 && line.length < 12) return false
    return true
  }
}
