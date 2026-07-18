package ai.trustlens.floatingassist

import android.content.Context

object TrustLensConfig {
  /** Matches mobile/.env EXPO_PUBLIC_API_BASE_URL default (Render deploy). */
  const val DEFAULT_API_BASE = "https://trustlens-ai-d3s2.onrender.com"

  private const val PREFS = "trustlens_native"
  private const val KEY_API = "api_base_url"

  fun apiBase(ctx: Context): String {
    val prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val stored = prefs.getString(KEY_API, null)?.trim()?.trimEnd('/')
    return if (!stored.isNullOrEmpty()) stored else DEFAULT_API_BASE
  }

  fun setApiBase(ctx: Context, url: String) {
    ctx.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_API, url.trim().trimEnd('/'))
      .apply()
  }
}
