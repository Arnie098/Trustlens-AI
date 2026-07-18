package ai.trustlens.floatingassist

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Sticky / high-priority notifications so the user always sees capture status.
 * Toasts are unreliable (Android often kills them when the app backgrounds).
 */
object CaptureNotifier {
  private const val CHANNEL_ID = "trustlens_capture"
  private const val NOTIF_PROGRESS = 71
  private const val NOTIF_RESULT = 72

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val existing = nm.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "TrustLens screen capture",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Screenshot and analysis status"
        setShowBadge(true)
      }
    nm.createNotificationChannel(channel)
  }

  /**
   * Notifications during capture/analyze must NOT launch MainActivity.
   * Result is shown as a floating overlay; tap does nothing (empty broadcast).
   */
  private fun noOpIntent(ctx: Context, requestCode: Int): PendingIntent {
    val intent = Intent("ai.trustlens.floatingassist.NOOP").setPackage(ctx.packageName)
    return PendingIntent.getBroadcast(
      ctx,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun showProgress(ctx: Context, title: String, text: String) {
    ensureChannel(ctx)
    val n =
      build(ctx, title, text, ongoing = true, autoCancel = false)
        .setProgress(0, 0, true)
        .setContentIntent(noOpIntent(ctx, 1))
        .build()
    nm(ctx).notify(NOTIF_PROGRESS, n)
  }

  fun showSuccess(ctx: Context, path: String) {
    ensureChannel(ctx)
    nm(ctx).cancel(NOTIF_PROGRESS)
    // Stay in Facebook — analysis already ran natively; no deep-link into app.
    val n =
      build(
        ctx,
        "TrustLens check ready",
        "See the floating card on your screen (tap path not required).",
        ongoing = false,
        autoCancel = true,
      )
        .setContentIntent(noOpIntent(ctx, 2))
        .build()
    nm(ctx).notify(NOTIF_RESULT, n)
  }

  fun showError(ctx: Context, message: String) {
    ensureChannel(ctx)
    nm(ctx).cancel(NOTIF_PROGRESS)
    val n =
      build(
        ctx,
        "Could not capture screen",
        message.take(120),
        ongoing = false,
        autoCancel = true,
      )
        .setContentIntent(noOpIntent(ctx, 3))
        .build()
    nm(ctx).notify(NOTIF_RESULT, n)
  }

  fun showInfo(ctx: Context, title: String, text: String) {
    ensureChannel(ctx)
    val n =
      build(ctx, title, text, ongoing = false, autoCancel = true)
        .setContentIntent(noOpIntent(ctx, 4))
        .build()
    nm(ctx).notify(NOTIF_RESULT, n)
  }

  fun cancelProgress(ctx: Context) {
    nm(ctx).cancel(NOTIF_PROGRESS)
  }

  private fun nm(ctx: Context) =
    ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun build(
    ctx: Context,
    title: String,
    text: String,
    ongoing: Boolean,
    autoCancel: Boolean,
  ): Notification.Builder {
    val b =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(ctx, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(ctx)
      }
    return b
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setOngoing(ongoing)
      .setAutoCancel(autoCancel)
      .setOnlyAlertOnce(true)
  }
}
