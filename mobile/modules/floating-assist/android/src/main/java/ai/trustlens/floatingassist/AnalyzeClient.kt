package ai.trustlens.floatingassist

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class QuickAnalyzeResult(
  val trustScore: Int,
  val category: String,
  val confidence: Int,
  val summary: String,
  val sourceAssessment: String,
  val contextAnalysis: String,
  val concerns: List<String>,
  val evidence: List<String>,
  val nextSteps: List<String>,
  val aiGenerated: Boolean,
  /** Visible text we fed the model (for the card “What we read”). */
  val excerpt: String,
)

/**
 * Floating-assist analyze — **server upload only** (no OCR-only fallback):
 *  1) Optional OCR as caption context only
 *  2) Compress JPEG → POST /api/uploads → public HTTPS URL (required)
 *  3) POST /api/analyze { type:image, imageUrl, text? } for Perplexity vision
 *
 * If upload fails, the check fails. We never analyze without a hosted image URL.
 */
object AnalyzeClient {
  private const val TAG = "TLAnalyze"
  private const val MAX_LONG_EDGE = 1600
  private const val JPEG_QUALITY = 82

  fun analyzeScreenshot(ctx: Context, imagePath: String): QuickAnalyzeResult {
    val ocr = ScreenTextExtractor.extract(imagePath)
    val jpeg = compressForUpload(imagePath)
    Log.i(TAG, "upload jpeg bytes=${jpeg.size}")

    val publicUrl =
      try {
        uploadToServer(ctx, jpeg)
      } catch (e: Exception) {
        val msg = e.message ?: "Upload failed"
        throw IllegalStateException(
          "Server upload required (POST /api/uploads). " +
            "Deploy the upload API on ${TrustLensConfig.apiBase(ctx)}. ($msg)",
          e,
        )
      }
    Log.i(TAG, "public imageUrl=$publicUrl")

    val body =
      JSONObject()
        .put("type", "image")
        .put("imageName", "trustlens-screen-capture.jpg")
        .put("imageUrl", publicUrl)
    if (ocr.isNotBlank()) body.put("text", ocr.take(4500))

    val result = postJson(ctx, "/api/analyze", body)
    return result.copy(
      excerpt = ocr.take(160).ifBlank { "Visual screen content (OCR limited)" },
    )
  }

  fun analyzeText(ctx: Context, text: String): QuickAnalyzeResult {
    val trimmed = text.trim()
    val body = JSONObject().put("type", "text").put("text", trimmed.take(5500))
    return postJson(ctx, "/api/analyze", body).copy(excerpt = trimmed.take(160))
  }

  /**
   * Resize long edge + re-encode so upload stays small (~LTE friendly).
   */
  private fun compressForUpload(imagePath: String): ByteArray {
    val file = File(imagePath)
    if (!file.exists()) throw IllegalStateException("Capture file missing.")

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)
    val w = bounds.outWidth.coerceAtLeast(1)
    val h = bounds.outHeight.coerceAtLeast(1)
    val longEdge = maxOf(w, h)
    var sample = 1
    while (longEdge / sample > MAX_LONG_EDGE * 2) sample *= 2

    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    var bitmap =
      BitmapFactory.decodeFile(file.absolutePath, opts)
        ?: throw IllegalStateException("Could not decode capture for upload.")

    try {
      val bw = bitmap.width
      val bh = bitmap.height
      val scale = MAX_LONG_EDGE.toFloat() / maxOf(bw, bh).toFloat()
      if (scale < 0.99f) {
        val nw = (bw * scale).toInt().coerceAtLeast(1)
        val nh = (bh * scale).toInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(bitmap, nw, nh, true)
        if (scaled !== bitmap) {
          bitmap.recycle()
          bitmap = scaled
        }
      }
      val out = ByteArrayOutputStream()
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)) {
        // Fallback: original file bytes
        return file.readBytes()
      }
      return out.toByteArray()
    } finally {
      if (!bitmap.isRecycled) bitmap.recycle()
    }
  }

  /**
   * POST /api/uploads with base64 JSON → { data: { url } }
   */
  private fun uploadToServer(ctx: Context, jpeg: ByteArray): String {
    val base = TrustLensConfig.apiBase(ctx)
    val b64 = Base64.encodeToString(jpeg, Base64.NO_WRAP)
    val body =
      JSONObject()
        .put("imageBase64", b64)
        .put("contentType", "image/jpeg")

    val url = URL("$base/api/uploads")
    val conn =
      (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 30_000
        readTimeout = 60_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json; charset=utf-8")
        setRequestProperty("Accept", "application/json")
      }
    try {
      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
      val code = conn.responseCode
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      val raw =
        BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
      if (code !in 200..299) {
        throw IllegalStateException("Upload HTTP $code: ${raw.take(220)}")
      }
      val root = JSONObject(raw)
      if (root.has("error") && !root.isNull("error")) {
        val err = root.optJSONObject("error")
        throw IllegalStateException(err?.optString("message") ?: "Upload failed")
      }
      val data = root.optJSONObject("data") ?: root
      val publicUrl = data.optString("url", "").trim()
      if (publicUrl.isEmpty()) {
        throw IllegalStateException("Upload response missing url")
      }
      return publicUrl
    } finally {
      conn.disconnect()
    }
  }

  private fun postJson(ctx: Context, path: String, body: JSONObject): QuickAnalyzeResult {
    val base = TrustLensConfig.apiBase(ctx)
    val url = URL("$base$path")
    val conn =
      (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 30_000
        readTimeout = 90_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json; charset=utf-8")
        setRequestProperty("Accept", "application/json")
      }

    try {
      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
      val code = conn.responseCode
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      val raw =
        BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
      if (code !in 200..299) {
        throw IllegalStateException("Analyze API HTTP $code: ${raw.take(200)}")
      }
      return parse(raw)
    } finally {
      conn.disconnect()
    }
  }

  private fun parse(raw: String): QuickAnalyzeResult {
    val root = JSONObject(raw)
    if (root.has("error") && !root.isNull("error")) {
      val err = root.optJSONObject("error")
      throw IllegalStateException(err?.optString("message") ?: "Analyze failed")
    }
    val data = root.optJSONObject("data") ?: root
    val score = data.optInt("trust_score", 50)
    val confRaw = data.optDouble("confidence", 0.0)
    val conf =
      when {
        confRaw in 0.0..1.0 && confRaw != 0.0 -> (confRaw * 100).toInt()
        else -> confRaw.toInt()
      }
    Log.i(TAG, "analyze ok score=$score")
    return QuickAnalyzeResult(
      trustScore = score.coerceIn(0, 100),
      category = data.optString("category", "needs_verification"),
      confidence = conf.coerceIn(0, 100),
      summary = tighten(data.optString("summary", "Analysis complete."), 280),
      sourceAssessment = tighten(data.optString("source_assessment", ""), 160),
      contextAnalysis = tighten(data.optString("context_analysis", ""), 160),
      concerns = jsonStringList(data.optJSONArray("concerns")).map { tighten(it, 120) }.take(3),
      evidence = jsonStringList(data.optJSONArray("evidence")).map { tighten(it, 120) }.take(3),
      nextSteps = jsonStringList(data.optJSONArray("next_steps")).map { tighten(it, 120) }.take(2),
      aiGenerated = data.optBoolean("ai_generated_detected", false),
      excerpt = "",
    )
  }

  private fun tighten(s: String, max: Int): String {
    val t = s.replace(Regex("""\s+"""), " ").trim()
    if (t.length <= max) return t
    return t.take(max - 1).trimEnd() + "…"
  }

  private fun jsonStringList(arr: JSONArray?): List<String> {
    if (arr == null) return emptyList()
    val out = ArrayList<String>()
    for (i in 0 until arr.length()) {
      val s = arr.optString(i, "").trim()
      if (s.isNotEmpty()) out.add(s)
    }
    return out
  }
}
