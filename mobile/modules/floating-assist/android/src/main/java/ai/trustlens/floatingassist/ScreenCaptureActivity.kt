package ai.trustlens.floatingassist

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Host for the system MediaProjection permission dialog.
 *
 * Must not look like a stuck TrustLens splash. If the OEM dialog is delayed or
 * never appears, show a clear cancelable panel so the user is never trapped.
 */
class ScreenCaptureActivity : Activity() {
  companion object {
    const val EXTRA_MODE = "mode"
    const val MODE_PERMISSION = "permission"
    const val MODE_CAPTURE = "capture"
    private const val REQ_MEDIA_PROJECTION = 7101
    private const val TIMEOUT_MS = 25_000L
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var mode: String = MODE_CAPTURE
  private var handedOff = false
  private var finished = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    mode = intent.getStringExtra(EXTRA_MODE) ?: MODE_CAPTURE

    // Dark solid panel — never transparent "stuck splash"
    setContentView(buildFallbackUi())

    // Small delay so the previous app can settle under us.
    mainHandler.postDelayed({ requestProjection() }, 180)
    // Escape hatch: never leave the user on a blank activity forever.
    mainHandler.postDelayed({
      if (!finished && !handedOff) {
        failAndFinish("Screen capture timed out. Open TrustLens again or tap the TL bubble.")
      }
    }, TIMEOUT_MS)
  }

  private fun dp(v: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics)
      .toInt()

  private fun buildFallbackUi(): View {
    val root =
      LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.parseColor("#0a1424"))
        setPadding(dp(28), dp(28), dp(28), dp(28))
        layoutParams =
          ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
          )
      }

    val title =
      TextView(this).apply {
        text = "Screen capture permission"
        setTextColor(Color.parseColor("#5ed4c8"))
        textSize = 18f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
      }

    val body =
      TextView(this).apply {
        text =
          "Android should show a system dialog to allow TrustLens to capture the screen once.\n\nIf you do not see it, tap Cancel and try the bubble again."
        setTextColor(Color.parseColor("#eef7f8"))
        textSize = 14f
        gravity = Gravity.CENTER
        setPadding(0, dp(16), 0, dp(24))
      }

    val cancel =
      Button(this).apply {
        text = "Cancel"
        setTextColor(Color.parseColor("#0a1424"))
        background =
          GradientDrawable().apply {
            cornerRadius = dp(24).toFloat()
            setColor(Color.parseColor("#5ed4c8"))
          }
        setOnClickListener {
          failAndFinish("Screen capture cancelled.")
        }
        setPadding(dp(28), dp(12), dp(28), dp(12))
      }

    root.addView(title)
    root.addView(body)
    root.addView(cancel)
    return root
  }

  private fun requestProjection() {
    if (finished) return
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
      // Remove the high-priority permission status before the captured frame.
      CaptureNotifier.cancelProgress(applicationContext)
      MediaProjectionCaptureService.start(applicationContext, resultCode, data)
      leaveWithoutOpeningApp()
    } catch (e: Exception) {
      CaptureResultStore.clearConsent()
      failAndFinish(e.message ?: "Could not start capture service.")
    }
  }

  /**
   * Exit this task and return the user to whatever app was under us.
   * NEVER launch MainActivity / TrustLens UI here.
   */
  private fun leaveWithoutOpeningApp() {
    if (finished) return
    finished = true
    mainHandler.removeCallbacksAndMessages(null)
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
    if (finished) return
    CaptureNotifier.cancelProgress(applicationContext)
    // Floating error over current app — do NOT open TrustLens.
    try {
      FloatingResultOverlay.showError(applicationContext, message)
      CaptureNotifier.showError(applicationContext, message)
      if (mode == MODE_CAPTURE) FloatingBubbleService.restoreBubble(applicationContext)
    } catch (_: Exception) {
    }
    leaveWithoutOpeningApp()
  }

  override fun onBackPressed() {
    failAndFinish("Screen capture cancelled.")
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
    finished = true
    super.finish()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }
}
