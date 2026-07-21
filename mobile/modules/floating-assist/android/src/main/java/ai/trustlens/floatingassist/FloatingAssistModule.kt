package ai.trustlens.floatingassist

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingAssistModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TrustLensFloatingAssist")

    AsyncFunction("isAvailable") {
      true
    }

    AsyncFunction("hasOverlayPermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(ctx)
      } else {
        true
      }
    }

    AsyncFunction("requestOverlayPermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${ctx.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return@AsyncFunction false
      }
      true
    }

    AsyncFunction("hasScreenCapturePermission") {
      CaptureResultStore.hasConsent()
    }

    /**
     * Opens the system MediaProjection permission dialog.
     * User must approve before VeriSphere can capture any screen content.
     */
    AsyncFunction("requestScreenCapturePermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(ctx, ScreenCaptureActivity::class.java).apply {
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_MULTIPLE_TASK or
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
            Intent.FLAG_ACTIVITY_NO_ANIMATION,
        )
        putExtra(ScreenCaptureActivity.EXTRA_MODE, ScreenCaptureActivity.MODE_PERMISSION)
      }
      ctx.startActivity(intent)
      true
    }

    /**
     * Capture the current screen via invisible activity + FGS.
     * Results show as a floating overlay — does not open assist UI.
     */
    AsyncFunction("captureScreen") {
      val ctx = appContext.reactContext ?: throw Exception("No Android context")
      val intent = Intent(ctx, ScreenCaptureActivity::class.java).apply {
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_MULTIPLE_TASK or
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
            Intent.FLAG_ACTIVITY_NO_ANIMATION,
        )
        putExtra(ScreenCaptureActivity.EXTRA_MODE, ScreenCaptureActivity.MODE_CAPTURE)
      }
      ctx.startActivity(intent)
      true
    }

    AsyncFunction("getLastCapturePath") {
      CaptureResultStore.lastCapturePath
    }

    AsyncFunction("setApiBaseUrl") { url: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      TrustLensConfig.setApiBase(ctx, url)
      true
    }

    AsyncFunction("startBubble") {
      val ctx = appContext.reactContext ?: throw Exception("No Android context")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
        throw Exception("Display-over-apps permission required")
      }
      val intent = Intent(ctx, FloatingBubbleService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
      true
    }

    AsyncFunction("stopBubble") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      ctx.stopService(Intent(ctx, FloatingBubbleService::class.java))
      true
    }
  }
}
