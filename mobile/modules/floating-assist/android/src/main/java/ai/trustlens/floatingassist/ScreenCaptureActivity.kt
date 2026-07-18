package ai.trustlens.floatingassist

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager

/**
 * Invisible host for the system MediaProjection permission dialog only.
 *
 * Must never pull the main TrustLens UI forward. Capture + analyze run in
 * [MediaProjectionCaptureService] and results show as a floating overlay over
 * Facebook (or whatever app the user was in).
 */
class ScreenCaptureActivity : Activity() {
  companion object {
    const val EXTRA_MODE = "mode"
    const val MODE_PERMISSION = "permission"
    const val MODE_CAPTURE = "capture"
    private const val REQ_MEDIA_PROJECTION = 7101
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var mode: String = MODE_CAPTURE
  private var handedOff = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    mode = intent.getStringExtra(EXTRA_MODE) ?: MODE_CAPTURE

    // Fully invisible chrome — only the system capture dialog should appear.
    makeInvisible()
    setContentView(View(this).apply { setBackgroundColor(Color.TRANSPARENT) })

    if (mode == MODE_CAPTURE) {
      CaptureNotifier.showProgress(
        this,
        "TrustLens is capturing…",
        "Approve screen capture if Android asks. Stay in Facebook — result is a floating card.",
      )
    }

    // Small delay so the previous app (Facebook) can settle under us.
    mainHandler.postDelayed({ requestProjection() }, 180)
  }

  private fun makeInvisible() {
    window.setFormat(PixelFormat.TRANSLUCENT)
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    }
    window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
    window.setDimAmount(0f)
    // No animations that look like "opening TrustLens"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      overrideActivityTransition(OVERRIDE_TRANSITION_OPEN, 0, 0)
      overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
    } else {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }

  private fun requestProjection() {
    try {
      val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      @Suppress("DEPRECATION")
      startActivityForResult(mpm.createScreenCaptureIntent(), REQ_MEDIA_PROJECTION)
    } catch (e: Exception) {
      failAndFinish(e.message ?: "Could not open screen-capture permission.")
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQ_MEDIA_PROJECTION) return

    if (resultCode != RESULT_OK || data == null) {
      CaptureResultStore.clearConsent()
      failAndFinish(
        "Screen capture permission was denied. Tap the bubble again and choose Start now / Allow.",
      )
      return
    }

    CaptureResultStore.setConsent(resultCode, data)

    if (mode == MODE_PERMISSION) {
      CaptureNotifier.showInfo(
        this,
        "Screen capture allowed",
        "Open Facebook, tap TL → Analyze. Results appear as a floating card — you stay in Facebook.",
      )
      CaptureNotifier.cancelProgress(this)
      leaveWithoutOpeningApp()
      return
    }

    // Hand off to FGS (mediaProjection type) — required before getMediaProjection on API 34+
    try {
      handedOff = true
      MediaProjectionCaptureService.start(applicationContext, resultCode, data)
      leaveWithoutOpeningApp()
    } catch (e: Exception) {
      CaptureResultStore.clearConsent()
      failAndFinish(e.message ?: "Could not start capture service.")
    }
  }

  /**
   * Exit this invisible task and return the user to whatever app was under us.
   * NEVER launch MainActivity / TrustLens UI here.
   */
  private fun leaveWithoutOpeningApp() {
    try {
      moveTaskToBack(true)
    } catch (_: Exception) {
    }
    finish()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
    } else {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }

  private fun failAndFinish(message: String) {
    CaptureNotifier.cancelProgress(applicationContext)
    // Floating error over current app — do NOT open TrustLens.
    FloatingResultOverlay.showError(applicationContext, message)
    CaptureNotifier.showError(applicationContext, message)
    leaveWithoutOpeningApp()
  }

  override fun onDestroy() {
    mainHandler.removeCallbacksAndMessages(null)
    if (!handedOff) {
      try {
        CaptureNotifier.cancelProgress(applicationContext)
      } catch (_: Exception) {
      }
    }
    super.onDestroy()
  }

  override fun finish() {
    super.finish()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }
}
