package ai.trustlens.floatingassist

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
/**
 * Floating bubble over other apps (e.g. Facebook).
 * Tap → menu: Analyze content on my screen | Copied text
 * Idle: soft-docks to the edge (still mostly visible).
 */
class FloatingBubbleService : Service() {
  private var windowManager: WindowManager? = null
  private var bubbleView: View? = null
  private var menuView: View? = null
  private val handler = Handler(Looper.getMainLooper())
  private var halfHideRunnable: Runnable? = null
  private var pulseRunnable: Runnable? = null
  private var bubbleParams: WindowManager.LayoutParams? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startAsForeground()
    showBubble()
    // Notification (toasts are often killed when leaving the app)
    handler.post {
      CaptureNotifier.showInfo(
        this,
        "TrustLens bubble is on",
        "Look for the teal “TL” on the right edge. Open Facebook, tap TL → Analyze content on my screen.",
      )
    }
  }

  override fun onDestroy() {
    halfHideRunnable?.let { handler.removeCallbacks(it) }
    pulseRunnable?.let { handler.removeCallbacks(it) }
    removeViews()
    super.onDestroy()
  }

  private fun startAsForeground() {
    val channelId = "trustlens_assist"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "TrustLens Assist",
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = "Floating verify assist is on"
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
    // Do not open TrustLens when user taps the ongoing notification
    val pi = PendingIntent.getBroadcast(
      this,
      42,
      Intent("ai.trustlens.floatingassist.NOOP").setPackage(packageName),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, channelId)
        .setContentTitle("TrustLens assist is on")
        .setContentText("Tap the teal TL bubble → analyze content on your screen")
        .setSmallIcon(android.R.drawable.ic_menu_info_details)
        .setContentIntent(pi)
        .setOngoing(true)
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setContentTitle("TrustLens assist is on")
        .setContentText("Tap the teal TL bubble → analyze content on your screen")
        .setSmallIcon(android.R.drawable.ic_menu_info_details)
        .setContentIntent(pi)
        .setOngoing(true)
        .build()
    }
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
        42,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else {
      startForeground(42, notification)
    }
  }

  private fun dp(v: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  private fun showBubble() {
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    // Larger + bright teal so it is obvious on real phones
    val size = dp(58)

    // Soft outer glow ring (sits behind the coin)
    val glow = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#332d8a9e"))
      }
    }

    // Gradient "coin" with the TrustLens logo mark
    val coin = FrameLayout(this).apply {
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor("#5ed4c8"), Color.parseColor("#2d8a9e"), Color.parseColor("#0c2340")),
      ).apply {
        shape = GradientDrawable.OVAL
        setStroke(dp(2), Color.parseColor("#7fe9dd"))
      }
      elevation = dp(10).toFloat()
    }
    val mark = ImageView(this).apply {
      setImageResource(R.drawable.trustlens_mark)
      scaleType = ImageView.ScaleType.FIT_CENTER
    }
    val pad = dp(13)
    coin.addView(mark, FrameLayout.LayoutParams(size, size).apply {
      leftMargin = pad; topMargin = pad; rightMargin = pad; bottomMargin = pad
      width = size - pad * 2; height = size - pad * 2
    })

    val bubble = coin
    val container = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(size, size)
      addView(glow, FrameLayout.LayoutParams(size, size))
      addView(bubble, FrameLayout.LayoutParams(size, size))
      // Always start fully visible
      visibility = View.VISIBLE
      alpha = 1f
    }

    // Breathing pulse: the glow gently expands/contracts to draw the eye
    glow.animate().cancel()
    val pulse = object : Runnable {
      override fun run() {
        glow.animate()
          .scaleX(1.35f).scaleY(1.35f).alpha(0.15f)
          .setDuration(1100)
          .withEndAction {
            glow.animate()
              .scaleX(1f).scaleY(1f).alpha(0.6f)
              .setDuration(1100)
              .withEndAction { handler.postDelayed(this, 400) }
              .start()
          }
          .start()
      }
    }
    handler.postDelayed(pulse, 600)
    pulseRunnable = pulse

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    val params = WindowManager.LayoutParams(
      size,
      size,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      // Fully on-screen at mid-right (not already half-hidden)
      x = resources.displayMetrics.widthPixels - size - dp(12)
      y = (resources.displayMetrics.heightPixels * 0.35f).toInt()
    }
    bubbleParams = params

    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f

    container.setOnTouchListener { v, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          // Bring fully on-screen while interacting
          scheduleHalfHide(params, false)
          v.alpha = 1f
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + (event.rawX - touchX).toInt()
          params.y = startY + (event.rawY - touchY).toInt()
          windowManager?.updateViewLayout(v, params)
          true
        }
        MotionEvent.ACTION_UP -> {
          val dx = Math.abs(event.rawX - touchX)
          val dy = Math.abs(event.rawY - touchY)
          if (dx < 12 && dy < 12) {
            toggleMenu(params)
          } else {
            snapToEdge(params, v)
            scheduleHalfHide(params, true)
          }
          true
        }
        else -> false
      }
    }

    bubbleView = container
    try {
      windowManager?.addView(container, params)
    } catch (e: Exception) {
      CaptureNotifier.showError(
        this,
        "Could not show floating bubble. Allow “Display over other apps” for TrustLens in Settings.",
      )
      stopSelf()
      return
    }
    // Stay fully visible for a few seconds so the user can find it
    scheduleHalfHide(params, true, delayMs = 6000)
  }

  private fun snapToEdge(params: WindowManager.LayoutParams, v: View) {
    val mid = resources.displayMetrics.widthPixels / 2
    params.x = if (params.x + v.width / 2 < mid) dp(8) else resources.displayMetrics.widthPixels - v.width - dp(8)
    windowManager?.updateViewLayout(v, params)
  }

  /**
   * Soft-dock: only hide ~25% of the bubble so it stays easy to find.
   * (Previously ~60% off-screen — nearly invisible on many phones.)
   */
  private fun scheduleHalfHide(
    params: WindowManager.LayoutParams,
    enable: Boolean,
    delayMs: Long = 5000,
  ) {
    halfHideRunnable?.let { handler.removeCallbacks(it) }
    val v = bubbleView
    if (!enable) {
      v?.alpha = 1f
      v?.visibility = View.VISIBLE
      // Pull fully on-screen again
      try {
        val size = v?.width ?: dp(56)
        val onLeft = params.x < resources.displayMetrics.widthPixels / 2
        params.x = if (onLeft) dp(8) else resources.displayMetrics.widthPixels - size - dp(8)
        if (v != null) windowManager?.updateViewLayout(v, params)
      } catch (_: Exception) {
      }
      return
    }
    halfHideRunnable = Runnable {
      val view = bubbleView ?: return@Runnable
      view.visibility = View.VISIBLE
      val onLeft = params.x < resources.displayMetrics.widthPixels / 2
      // Keep most of the circle visible (only a small tuck)
      params.x =
        if (onLeft) -view.width / 4
        else resources.displayMetrics.widthPixels - (view.width * 3 / 4)
      try {
        windowManager?.updateViewLayout(view, params)
        view.alpha = 0.92f
      } catch (_: Exception) {
      }
    }
    handler.postDelayed(halfHideRunnable!!, delayMs)
  }

  private fun toggleMenu(bubbleParams: WindowManager.LayoutParams) {
    if (menuView != null) {
      hideMenu()
      return
    }
    showMenu(bubbleParams)
  }

  private fun hideMenu() {
    menuView?.let {
      try {
        windowManager?.removeView(it)
      } catch (_: Exception) {
      }
    }
    menuView = null
  }

  private fun setBubbleVisible(visible: Boolean) {
    val v = bubbleView ?: return
    v.visibility = if (visible) View.VISIBLE else View.INVISIBLE
    v.alpha = if (visible) 1f else 0f
    // After capture, put bubble fully on-screen again
    if (visible) {
      val params = bubbleParams
      if (params != null) {
        try {
          val size = v.width.takeIf { it > 0 } ?: dp(56)
          params.x = resources.displayMetrics.widthPixels - size - dp(12)
          windowManager?.updateViewLayout(v, params)
          scheduleHalfHide(params, true, delayMs = 6000)
        } catch (_: Exception) {
        }
      }
    }
  }

  private fun showMenu(bubbleParams: WindowManager.LayoutParams) {
    halfHideRunnable?.let { handler.removeCallbacks(it) }
    bubbleView?.alpha = 1f

    val panel = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(12), dp(12), dp(12))
      background = GradientDrawable().apply {
        setColor(Color.WHITE)
        cornerRadius = dp(16).toFloat()
        setStroke(dp(1), Color.parseColor("#d5e0e8"))
      }
    }

    fun addBtn(label: String, sub: String, onClick: () -> Unit) {
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(12), dp(10), dp(12), dp(10))
        background = GradientDrawable().apply {
          setColor(Color.parseColor("#f5f9fb"))
          cornerRadius = dp(12).toFloat()
        }
        val lp = LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT
        )
        lp.bottomMargin = dp(8)
        layoutParams = lp
        setOnClickListener {
          hideMenu()
          onClick()
        }
      }
      row.addView(TextView(this).apply {
        text = label
        setTextColor(Color.parseColor("#0c2340"))
        textSize = 15f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
      })
      row.addView(TextView(this).apply {
        text = sub
        setTextColor(Color.parseColor("#5a6b7c"))
        textSize = 12f
      })
      panel.addView(row)
    }

    panel.addView(TextView(this).apply {
      text = "TrustLens"
      setTextColor(Color.parseColor("#0c2340"))
      textSize = 16f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, 0, 0, dp(4))
    })
    panel.addView(TextView(this).apply {
      text = "Analyze what is on your screen. The bubble takes a screenshot, then AI checks it. Android will ask your permission first."
      setTextColor(Color.parseColor("#5a6b7c"))
      textSize = 12f
      setPadding(0, 0, 0, dp(10))
    })

    // Primary action: screenshot (by TrustLens) → AI analyze
    addBtn(
      "Analyze content on my screen",
      "1) Screenshot  2) AI analyzes  ·  you approve once",
    ) {
      startScreenCapture()
    }

    // Secondary (smaller wording)
    addBtn(
      "Use copied text instead",
      "Only if you already copied a caption",
    ) {
      openAssist("clipboard")
    }

    panel.addView(TextView(this).apply {
      text = "Not now"
      gravity = Gravity.CENTER
      setTextColor(Color.parseColor("#5a6b7c"))
      setPadding(0, dp(6), 0, 0)
      setOnClickListener { hideMenu() }
    })

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    val params = WindowManager.LayoutParams(
      dp(280),
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = (bubbleParams.x - dp(220)).coerceAtLeast(dp(8))
      y = bubbleParams.y + dp(56)
    }

    menuView = panel
    windowManager?.addView(panel, params)
  }

  /**
   * Hide bubble/menu, then open the *invisible* capture activity (own task) so
   * Android can show only the MediaProjection permission dialog. Results stay
   * as a floating overlay — MainActivity / TrustLens UI must not come forward.
   */
  private fun startScreenCapture() {
    halfHideRunnable?.let { handler.removeCallbacks(it) }
    hideMenu()
    setBubbleVisible(false)
    handler.postDelayed({
      val intent = Intent(this, ScreenCaptureActivity::class.java).apply {
        // Own task (see manifest taskAffinity + singleInstance) — never MainActivity
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_MULTIPLE_TASK or
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or
            Intent.FLAG_ACTIVITY_NO_ANIMATION,
        )
        putExtra(ScreenCaptureActivity.EXTRA_MODE, ScreenCaptureActivity.MODE_CAPTURE)
      }
      startActivity(intent)
      // Restore bubble after a moment so it stays available for the next post
      handler.postDelayed({ setBubbleVisible(true) }, 1800)
    }, 80)
  }

  private fun openAssist(action: String) {
    val uri = Uri.parse("trustlens://assist?action=$action")
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      setPackage(packageName)
    }
    startActivity(intent)
  }

  private fun removeViews() {
    hideMenu()
    bubbleView?.let {
      try {
        windowManager?.removeView(it)
      } catch (_: Exception) {
      }
    }
    bubbleView = null
  }
}
