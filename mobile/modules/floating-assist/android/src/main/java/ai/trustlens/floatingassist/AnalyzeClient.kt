package ai.trustlens.floatingassist

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
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
 * Native POST /api/analyze for floating overlay results over Facebook.
 * Prefer OCR of the real screen; never send a meta “screenshot advice” prompt.
 */
object AnalyzeClient {
  private const val TAG = "TLAnalyze"

  fun analyzeScreenshot(ctx: Context, imagePath: String): QuickAnalyzeResult {
    val ocr = ScreenTextExtractor.extract(imagePath)
    val prompt = buildMobilePrompt(ocr)
    val result = postText(ctx, prompt)
    return result.copy(excerpt = ocr.take(160).ifBlank { "Limited readable text on screen" })
  }

  fun analyzeText(ctx: Context, text: String): QuickAnalyzeResult {
    val trimmed = text.trim()
    val prompt =
      if (trimmed.length >= 8) {
        buildMobilePrompt(trimmed, sourceLabel = "clipboard / shared text")
      } else {
        trimmed
      }
    return postText(ctx, prompt).copy(excerpt = trimmed.take(160))
  }

  /**
   * Tight, content-specific instructions so the model grades the *post*,
   * not the fact that someone took a screenshot.
   */
  private fun buildMobilePrompt(
    visibleText: String,
    sourceLabel: String = "Facebook / social screenshot (on-device OCR)",
  ): String {
    val body =
      if (visibleText.trim().length >= 12) {
        visibleText.trim().take(4000)
      } else {
        """
        (Little readable text extracted. Screen may be mostly images/video/UI.)
        Treat this as a visual social post with weak textual claims.
        """.trimIndent()
      }

    return """
      [TrustLens mobile floating card — judge THIS content only]

      Source: $sourceLabel

      VISIBLE CONTENT:
      \"\"\"
      $body
      \"\"\"

      Rules:
      1) Analyze the claims, framing, and provenance of THIS content — NOT the act of screenshotting.
      2) If it is a game, meme, ad, personal update, or non-news UI with no factual claim, say so clearly; score higher (typically 70–90) and keep concerns light.
      3) If it is a news/health/politics claim, grade sourcing, emotional framing, missing context, and verifiability.
      4) summary: MAX 2 short sentences. Name what the content is about + the main trust signal. No boilerplate about "screenshots in general".
      5) concerns: 0–3 SHORT, concrete bullets about THIS content (not generic advice).
      6) evidence: 0–3 short supporting signals or web-check notes.
      7) next_steps: exactly 2 practical checks a reader can do in ~30 seconds.
      8) source_assessment + context_analysis: 1 short sentence each.
      9) Use hedged language (signals, not verdicts). Never claim absolute truth.
    """.trimIndent()
  }

  private fun postText(ctx: Context, text: String): QuickAnalyzeResult {
    val base = TrustLensConfig.apiBase(ctx)
    val body = JSONObject().put("type", "text").put("text", text.take(5500))

    val url = URL("$base/api/analyze")
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
