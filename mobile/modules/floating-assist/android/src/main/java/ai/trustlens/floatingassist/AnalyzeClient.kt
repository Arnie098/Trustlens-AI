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
  /** Server engine_path: claude_vision | screenshot_ocr_* | … */
  val enginePath: String = "",
)

/**
 * Floating-assist analyze — **Claude vision only, no fallback**:
 *  1) Compress screenshot JPEG → base64
 *  2) POST /api/analyze/vision { type:image, imageBase64 } — Claude reads the pixels
 *
 * There is no OCR, no Perplexity, no upload hop. If Claude vision fails, the check fails.
 */
object AnalyzeClient {
  private const val TAG = "TLAnalyze"
  /** Keep text readable for vision + OCR of social posts */
  private const val MAX_LONG_EDGE = 1920
  private const val JPEG_QUALITY = 90
  /** freemodel vision + Render cold starts often exceed 90s. */
  private const val UPLOAD_CONNECT_MS = 45_000
  private const val UPLOAD_READ_MS = 90_000
  private const val ANALYZE_CONNECT_MS = 45_000
  private const val ANALYZE_READ_MS = 240_000

  fun analyzeScreenshot(
    ctx: Context,
    imagePath: String,
    onStatus: ((AnalyzeLoadStage, String) -> Unit)? = null,
  ): QuickAnalyzeResult {
    fun status(stage: AnalyzeLoadStage, detail: String) {
      try {
        onStatus?.invoke(stage, detail)
      } catch (_: Exception) {
      }
    }

    // Compress → send JPEG bytes straight to Claude (no upload hop, no OCR-primary path).
    status(AnalyzeLoadStage.PREPARE, "Compressing screenshot for Claude vision…")
    val jpeg = compressForUpload(imagePath)
    val b64 = Base64.encodeToString(jpeg, Base64.NO_WRAP)
    Log.i(TAG, "direct Claude jpeg bytes=${jpeg.size} b64KB=${b64.length / 1024}")

    status(
      AnalyzeLoadStage.UPLOAD,
      "Sending image (${jpeg.size / 1024} KB) to Claude via server…",
    )

    // No protocol essay in `text` — that was being analyzed as the "post" when vision failed.
    // Image bytes go in imageBase64; server prompt tells Claude to read the pixels.
    val body =
      JSONObject()
        .put("type", "image")
        .put("imageName", "social-feed-screenshot.jpg")
        .put("imageMediaType", "image/jpeg")
        .put("imageBase64", b64)
        .put("text", "mobile_social_screenshot")

    status(
      AnalyzeLoadStage.VISION,
      "Claude is looking at your screenshot (often 30s–2 min)…",
    )
    val result =
      try {
        postJson(ctx, "/api/analyze/vision", body)
      } catch (e: Exception) {
        throw IllegalStateException(friendlyNetError("Analysis", e), e)
      }
    status(AnalyzeLoadStage.FINISH, "Building your result card…")
    return result.copy(excerpt = "Claude vision · screenshot")
  }

  private fun friendlyNetError(phase: String, e: Exception): String {
    val raw = (e.message ?: e.javaClass.simpleName).trim()
    val lower = raw.lowercase()
    return when {
      lower.contains("timeout") ||
        lower.contains("timed out") ||
        e is java.net.SocketTimeoutException ->
        "$phase took too long (AI vision can need 2–3 min on first try). Tap Analyze again."
      lower.contains("unable to resolve") || lower.contains("unknownhost") ->
        "$phase failed: no internet / cannot reach server."
      lower.contains("connection") && (lower.contains("refused") || lower.contains("reset")) ->
        "$phase failed: server connection dropped. Try again in a moment."
      raw.equals("timeout", ignoreCase = true) ->
        "$phase timed out. Try again — vision analysis can take a while."
      else -> raw.take(220)
    }
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
        connectTimeout = UPLOAD_CONNECT_MS
        readTimeout = UPLOAD_READ_MS
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
        throw IllegalStateException("Upload HTTP $code: ${summarizeBody(raw)}")
      }
      val root = parseJsonObject(raw, "upload")
      if (root.has("error") && !root.isNull("error")) {
        val err = root.optJSONObject("error")
        throw IllegalStateException(err?.optString("message") ?: "Upload failed")
      }
      val data = root.optJSONObject("data") ?: root
      val publicUrl = data.optString("url", "").trim()
      if (publicUrl.isEmpty()) {
        throw IllegalStateException("Upload response missing url: ${summarizeBody(raw)}")
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
        connectTimeout = ANALYZE_CONNECT_MS
        readTimeout = ANALYZE_READ_MS
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
        throw IllegalStateException("Analyze API HTTP $code: ${summarizeBody(raw)}")
      }
      return parse(raw)
    } finally {
      conn.disconnect()
    }
  }

  /** Avoid cryptic "Value <!DOCTYPE of type String cannot be converted to JSONObject". */
  private fun parseJsonObject(raw: String, where: String): JSONObject {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) {
      throw IllegalStateException("Unexpected empty response from $where")
    }
    if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
      throw IllegalStateException(
        "Unexpected HTML response from $where (expected JSON). " +
          "Server may be cold, wrong URL, or route missing. ${summarizeBody(trimmed)}",
      )
    }
    return try {
      JSONObject(trimmed)
    } catch (e: Exception) {
      throw IllegalStateException(
        "Unexpected non-JSON response from $where: ${summarizeBody(trimmed)}",
        e,
      )
    }
  }

  private fun summarizeBody(raw: String): String {
    val oneLine = raw.replace(Regex("""\s+"""), " ").trim()
    return oneLine.take(180)
  }

  private fun parse(raw: String): QuickAnalyzeResult {
    val root = parseJsonObject(raw, "analyze")
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
    val enginePath =
      data.optString("engine_path", "").ifBlank {
        root.optString("engine_path", "")
      }
    Log.i(TAG, "analyze ok score=$score path=$enginePath")
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
      enginePath = enginePath,
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
