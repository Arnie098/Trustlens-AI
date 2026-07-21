package ai.trustlens.floatingassist

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Android 14+ requires a foreground service of type [mediaProjection]
 * before [MediaProjectionManager.getMediaProjection] will succeed.
 *
 * After capture, analyzes via HTTP and shows a floating result card
 * **without** forcing the user back into the VeriSphere app UI.
 */
class MediaProjectionCaptureService : Service() {
  companion object {
    private const val TAG = "TLMediaProjection"
    private const val CHANNEL_ID = "trustlens_media_projection"
    private const val NOTIF_ID = 73

    const val EXTRA_RESULT_CODE = "result_code"
    const val EXTRA_RESULT_DATA = "result_data"

    fun start(context: Context, resultCode: Int, resultData: Intent) {
      val i =
        Intent(context, MediaProjectionCaptureService::class.java).apply {
          putExtra(EXTRA_RESULT_CODE, resultCode)
          putExtra(EXTRA_RESULT_DATA, resultData)
        }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(i)
      } else {
        context.startService(i)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startAsMediaProjectionForeground()

    if (intent == null) {
      fail("Missing capture intent.")
      return START_NOT_STICKY
    }

    val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
    @Suppress("DEPRECATION")
    val resultData: Intent? =
      if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
      } else {
        intent.getParcelableExtra(EXTRA_RESULT_DATA)
      }

    if (resultCode == 0 || resultData == null) {
      fail("Screen capture permission data is missing. Allow the system dialog and try again.")
      return START_NOT_STICKY
    }

    Thread {
      try {
        // Let the permission dialog, VeriSphere UI, and notifications clear
        // so the frame is the underlying app (Facebook), not our chrome.
        CaptureNotifier.cancelProgress(this)
        FloatingResultOverlay.dismiss()
        FloatingResultOverlay.showAnalyzing(
          this,
          AnalyzeLoadStage.CAPTURE,
          "Waiting for a clean frame (hiding our UI)…",
        )
        Thread.sleep(1100)

        FloatingResultOverlay.updateAnalyzing(
          this,
          AnalyzeLoadStage.CAPTURE,
          "Requesting MediaProjection frame…",
        )
        val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection: MediaProjection =
          try {
            mpm.getMediaProjection(resultCode, resultData)
          } catch (e: Exception) {
            Log.e(TAG, "getMediaProjection failed", e)
            throw IllegalStateException(
              "Could not start screen capture (${e.message}). Allow the permission and try again.",
              e,
            )
          }
            ?: throw IllegalStateException(
              "Could not start screen capture. Allow the permission and try again.",
            )

        FloatingResultOverlay.updateAnalyzing(
          this,
          AnalyzeLoadStage.CAPTURE,
          "Grabbing pixels from your screen…",
        )
        val path = ScreenCaptureHelper.captureFrame(applicationContext, projection)
        Log.i(TAG, "Capture OK: $path")

        FloatingResultOverlay.updateAnalyzing(
          this,
          AnalyzeLoadStage.PREPARE,
          "Screenshot saved · preparing for AI…",
        )
        CaptureNotifier.showProgress(
          this,
          "Analyzing…",
          "VeriSphere AI is running — stay on this screen.",
        )

        val result =
          AnalyzeClient.analyzeScreenshot(applicationContext, path) { stage, detail ->
            FloatingResultOverlay.updateAnalyzing(this, stage, detail)
          }
        FloatingResultOverlay.updateAnalyzing(
          this,
          AnalyzeLoadStage.FINISH,
          "Done · opening result…",
        )
        mainSucceed(result, path)
      } catch (e: Exception) {
        Log.e(TAG, "Capture/analyze failed", e)
        mainFail(e.message ?: "Could not capture or analyze the screen.")
      }
    }.start()

    return START_NOT_STICKY
  }

  private fun startAsMediaProjectionForeground() {
    ensureChannel()
    // No content intent → tapping the FGS notification must not open VeriSphere.
    val noop =
      PendingIntent.getBroadcast(
        this,
        73,
        Intent("ai.trustlens.floatingassist.NOOP").setPackage(packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val notification: Notification =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL_ID)
          .setContentTitle("VeriSphere screen capture")
          .setContentText("Capturing & analyzing — stay in your app")
          .setSmallIcon(android.R.drawable.ic_menu_camera)
          .setContentIntent(noop)
          .setOngoing(true)
          .build()
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
          .setContentTitle("VeriSphere screen capture")
          .setContentText("Capturing & analyzing — stay in your app")
          .setSmallIcon(android.R.drawable.ic_menu_camera)
          .setContentIntent(noop)
          .setOngoing(true)
          .build()
      }

    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(
        NOTIF_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
      )
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    nm.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "VeriSphere media projection",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Required while capturing the screen"
      },
    )
  }

  private fun mainSucceed(result: QuickAnalyzeResult, path: String) {
    android.os.Handler(mainLooper).post {
      CaptureNotifier.cancelProgress(this)
      CaptureNotifier.showInfo(
        this,
        "VeriSphere · score ${result.trustScore}",
        result.summary.take(100),
      )
      FloatingResultOverlay.showResult(this, result)
      FloatingBubbleService.restoreBubble(this)
      // Optional: keep path for "Open app" deep analysis later
      CaptureResultStore.lastCapturePath = path
      stopSelfSafely()
    }
  }

  private fun mainFail(message: String) {
    android.os.Handler(mainLooper).post {
      CaptureNotifier.showError(this, message)
      CaptureNotifier.cancelProgress(this)
      FloatingResultOverlay.showError(this, message)
      FloatingBubbleService.restoreBubble(this)
      stopSelfSafely()
    }
  }

  private fun fail(message: String) {
    CaptureNotifier.showError(this, message)
    CaptureNotifier.cancelProgress(this)
    FloatingResultOverlay.showError(this, message)
    FloatingBubbleService.restoreBubble(this)
    stopSelfSafely()
  }

  private fun stopSelfSafely() {
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
    }
    stopSelf()
  }
}
