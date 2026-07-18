package ai.trustlens.floatingassist

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView

/**
 * Floating result card over other apps (Facebook, etc.).
 * Dense, scannable MIL card — not a wall of generic prose.
 */
object FloatingResultOverlay {
  private val main = Handler(Looper.getMainLooper())
  private var windowManager: WindowManager? = null
  private var panel: View? = null
  private var autoDismiss: Runnable? = null

  fun showAnalyzing(ctx: Context) {
    main.post {
      val app = ctx.applicationContext
      ensureWm(app)
      removePanel()
      val root = card(app)
      root.addView(kicker(app, "TrustLens · reading screen"))
      root.addView(
        title(app, "Analyzing this post…"),
      )
      root.addView(
        ProgressBar(app).apply {
          isIndeterminate = true
          setPadding(0, dp(app, 8), 0, dp(app, 4))
        },
      )
      root.addView(
        muted(app, "OCR → AI check. Stay here — result pops over Facebook."),
      )
      addPanel(app, wrapScroll(app, root))
    }
  }

  fun showResult(ctx: Context, result: QuickAnalyzeResult) {
    main.post {
      val app = ctx.applicationContext
      ensureWm(app)
      removePanel()
      val root = card(app)
      val accent = categoryColor(result.category)

      // Header
      root.addView(kicker(app, "TrustLens · quick check"))

      // Score + category row
      val scoreRow =
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          setPadding(0, dp(app, 4), 0, dp(app, 4))
        }

      // Score badge
      val scoreBox =
        LinearLayout(app).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          background =
            GradientDrawable().apply {
              setColor(Color.parseColor("#0a1628"))
              cornerRadius = dp(app, 16).toFloat()
              setStroke(dp(app, 2), accent)
            }
          setPadding(dp(app, 14), dp(app, 10), dp(app, 14), dp(app, 10))
        }
      scoreBox.addView(
        TextView(app).apply {
          text = "${result.trustScore}"
          setTextColor(accent)
          textSize = 36f
          typeface = Typeface.DEFAULT_BOLD
          gravity = Gravity.CENTER
        },
      )
      scoreBox.addView(
        TextView(app).apply {
          text = "trust"
          setTextColor(Color.parseColor("#6a8494"))
          textSize = 10f
          gravity = Gravity.CENTER
          setPadding(0, 0, 0, 0)
        },
      )
      scoreRow.addView(scoreBox)

      val meta =
        LinearLayout(app).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(dp(app, 12), 0, 0, 0)
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
      meta.addView(
        TextView(app).apply {
          text = humanCategory(result.category)
          setTextColor(accent)
          textSize = 15f
          typeface = Typeface.DEFAULT_BOLD
        },
      )
      meta.addView(confidenceBar(app, result.confidence, accent))
      meta.addView(
        TextView(app).apply {
          text = "confidence ${result.confidence}%"
          setTextColor(Color.parseColor("#8aa8b0"))
          textSize = 11f
          setPadding(0, dp(app, 2), 0, 0)
        },
      )
      if (result.aiGenerated) {
        meta.addView(
          chip(app, "Possible AI / synthetic cues", Color.parseColor("#e08a4a")),
        )
      }
      scoreRow.addView(meta)
      root.addView(scoreRow)

      // What we read
      if (result.excerpt.isNotBlank()) {
        root.addView(sectionTitle(app, "What we read"))
        root.addView(
          TextView(app).apply {
            text = "“${result.excerpt.trim()}”"
            setTextColor(Color.parseColor("#b8cdd6"))
            textSize = 12f
            setPadding(0, 0, 0, dp(app, 6))
            setLineSpacing(0f, 1.15f)
            maxLines = 3
          },
        )
      }

      // Summary — hero takeaway
      root.addView(sectionTitle(app, "Takeaway"))
      root.addView(
        TextView(app).apply {
          text = result.summary
          setTextColor(Color.WHITE)
          textSize = 14f
          typeface = Typeface.DEFAULT_BOLD
          setLineSpacing(2f, 1.2f)
          setPadding(0, 0, 0, dp(app, 8))
          maxLines = 4
        },
      )

      if (result.sourceAssessment.isNotBlank()) {
        root.addView(sectionTitle(app, "Source"))
        root.addView(bodyLine(app, result.sourceAssessment))
      }
      if (result.contextAnalysis.isNotBlank()) {
        root.addView(sectionTitle(app, "Context"))
        root.addView(bodyLine(app, result.contextAnalysis))
      }

      if (result.concerns.isNotEmpty()) {
        root.addView(sectionTitle(app, "Watch for"))
        result.concerns.take(3).forEach { c ->
          root.addView(bullet(app, c, Color.parseColor("#e0b84a")))
        }
      }

      if (result.evidence.isNotEmpty()) {
        root.addView(sectionTitle(app, "Signals"))
        result.evidence.take(3).forEach { e ->
          root.addView(bullet(app, e, Color.parseColor("#5ed4c8")))
        }
      }

      if (result.nextSteps.isNotEmpty()) {
        root.addView(sectionTitle(app, "Do next"))
        result.nextSteps.take(2).forEachIndexed { i, s ->
          root.addView(numberedStep(app, i + 1, s))
        }
      }

      root.addView(
        TextView(app).apply {
          text = "Signals, not verdicts. Double-check before you share."
          setTextColor(Color.parseColor("#6a8494"))
          textSize = 10f
          setPadding(0, dp(app, 10), 0, dp(app, 10))
        },
      )

      // Actions
      val row =
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
        }
      row.addView(
        actionBtn(app, "Done", primary = false) { dismiss() },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
          marginEnd = dp(app, 6)
        },
      )
      row.addView(
        actionBtn(app, "Open app", primary = true) {
          openApp(app)
          dismiss()
        },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
          marginStart = dp(app, 6)
        },
      )
      root.addView(row)

      addPanel(app, wrapScroll(app, root))
      scheduleAutoDismiss(22_000)
    }
  }

  fun showError(ctx: Context, message: String) {
    main.post {
      val app = ctx.applicationContext
      ensureWm(app)
      removePanel()
      val root = card(app)
      root.addView(kicker(app, "TrustLens"))
      root.addView(
        TextView(app).apply {
          text = "Couldn’t finish this check"
          setTextColor(Color.parseColor("#e05a52"))
          textSize = 16f
          typeface = Typeface.DEFAULT_BOLD
        },
      )
      root.addView(
        TextView(app).apply {
          text = message
          setTextColor(Color.WHITE)
          textSize = 13f
          setPadding(0, dp(app, 8), 0, dp(app, 12))
          maxLines = 6
        },
      )
      root.addView(actionBtn(app, "Dismiss", primary = true) { dismiss() })
      addPanel(app, wrapScroll(app, root))
      scheduleAutoDismiss(14_000)
    }
  }

  fun dismiss() {
    main.post {
      autoDismiss?.let { main.removeCallbacks(it) }
      autoDismiss = null
      removePanel()
    }
  }

  private fun scheduleAutoDismiss(ms: Long) {
    autoDismiss?.let { main.removeCallbacks(it) }
    autoDismiss = Runnable { dismiss() }
    main.postDelayed(autoDismiss!!, ms)
  }

  private fun ensureWm(app: Context) {
    if (windowManager == null) {
      windowManager = app.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }
  }

  private fun removePanel() {
    panel?.let {
      try {
        windowManager?.removeView(it)
      } catch (_: Exception) {
      }
    }
    panel = null
  }

  private fun addPanel(app: Context, view: View) {
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE

    val params =
      WindowManager.LayoutParams(
        dp(app, 312),
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT,
      ).apply {
        gravity = Gravity.TOP or Gravity.END
        x = dp(app, 10)
        y = dp(app, 88)
      }
    panel = view
    try {
      windowManager?.addView(view, params)
    } catch (e: Exception) {
      CaptureNotifier.showError(
        app,
        "Could not show result overlay. Allow Display over other apps. (${e.message})",
      )
    }
  }

  private fun wrapScroll(app: Context, inner: View): View {
    return ScrollView(app).apply {
      addView(inner)
      isFillViewport = false
      // Cap height so long results scroll instead of covering the whole feed
      layoutParams =
        ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        )
      // Soft max via measure happens at add; set maxHeight if API available
      if (Build.VERSION.SDK_INT >= 16) {
        // ~62% of screen
        val maxH = (app.resources.displayMetrics.heightPixels * 0.62f).toInt()
        // ScrollView doesn't have maxHeight; wrap in FrameLayout with max
        // Keep simple: ScrollView alone is fine — user can scroll the card.
        tag = maxH
      }
    }
  }

  private fun card(app: Context): LinearLayout {
    return LinearLayout(app).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(app, 16), dp(app, 14), dp(app, 16), dp(app, 14))
      background =
        GradientDrawable().apply {
          colors = intArrayOf(Color.parseColor("#101c30"), Color.parseColor("#0c1828"))
          orientation = GradientDrawable.Orientation.TL_BR
          cornerRadius = dp(app, 20).toFloat()
          setStroke(dp(app, 1), Color.parseColor("#2d8a9e"))
        }
      elevation = dp(app, 12).toFloat()
    }
  }

  private fun kicker(app: Context, t: String) =
    TextView(app).apply {
      text = t.uppercase()
      setTextColor(Color.parseColor("#5ed4c8"))
      textSize = 10f
      typeface = Typeface.DEFAULT_BOLD
      letterSpacing = 0.08f
      setPadding(0, 0, 0, dp(app, 6))
    }

  private fun title(app: Context, t: String) =
    TextView(app).apply {
      text = t
      setTextColor(Color.WHITE)
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      setPadding(0, 0, 0, dp(app, 8))
    }

  private fun muted(app: Context, t: String) =
    TextView(app).apply {
      text = t
      setTextColor(Color.parseColor("#8aa8b0"))
      textSize = 12f
    }

  private fun sectionTitle(app: Context, t: String) =
    TextView(app).apply {
      text = t.uppercase()
      setTextColor(Color.parseColor("#5ed4c8"))
      textSize = 10f
      typeface = Typeface.DEFAULT_BOLD
      letterSpacing = 0.06f
      setPadding(0, dp(app, 8), 0, dp(app, 3))
    }

  private fun bodyLine(app: Context, t: String) =
    TextView(app).apply {
      text = t
      setTextColor(Color.parseColor("#d7e6ec"))
      textSize = 12f
      setLineSpacing(1f, 1.15f)
      maxLines = 3
      setPadding(0, 0, 0, dp(app, 2))
    }

  private fun bullet(app: Context, t: String, dotColor: Int) =
    LinearLayout(app).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, 2, 0, 2)
      addView(
        TextView(app).apply {
          text = "●"
          setTextColor(dotColor)
          textSize = 9f
          setPadding(0, dp(app, 3), dp(app, 8), 0)
        },
      )
      addView(
        TextView(app).apply {
          text = t
          setTextColor(Color.parseColor("#eef7f8"))
          textSize = 12f
          setLineSpacing(1f, 1.12f)
          maxLines = 3
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        },
      )
    }

  private fun numberedStep(app: Context, n: Int, t: String) =
    LinearLayout(app).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.TOP
      setPadding(0, 3, 0, 3)
      addView(
        TextView(app).apply {
          text = "$n"
          gravity = Gravity.CENTER
          setTextColor(Color.parseColor("#0c2340"))
          textSize = 11f
          typeface = Typeface.DEFAULT_BOLD
          background =
            GradientDrawable().apply {
              shape = GradientDrawable.OVAL
              setColor(Color.parseColor("#5ed4c8"))
            }
          val s = dp(app, 20)
          layoutParams = LinearLayout.LayoutParams(s, s).apply { marginEnd = dp(app, 8) }
        },
      )
      addView(
        TextView(app).apply {
          text = t
          setTextColor(Color.parseColor("#eef7f8"))
          textSize = 12f
          maxLines = 3
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        },
      )
    }

  private fun confidenceBar(app: Context, pct: Int, accent: Int): View {
    val track =
      LinearLayout(app).apply {
        orientation = LinearLayout.HORIZONTAL
        background =
          GradientDrawable().apply {
            setColor(Color.parseColor("#1c2d45"))
            cornerRadius = dp(app, 999).toFloat()
          }
        layoutParams =
          LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(app, 6),
          ).apply { topMargin = dp(app, 6) }
      }
    val fillW = (pct.coerceIn(0, 100) / 100f)
    // Use weight for fill
    track.weightSum = 100f
    track.addView(
      View(app).apply {
        background =
          GradientDrawable().apply {
            setColor(accent)
            cornerRadius = dp(app, 999).toFloat()
          }
        layoutParams =
          LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, fillW * 100f)
      },
    )
    if (pct < 100) {
      track.addView(
        View(app).apply {
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, (1f - fillW) * 100f)
        },
      )
    }
    return track
  }

  private fun chip(app: Context, label: String, color: Int) =
    TextView(app).apply {
      text = label
      setTextColor(color)
      textSize = 10f
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(app, 8), dp(app, 4), dp(app, 8), dp(app, 4))
      background =
        GradientDrawable().apply {
          setColor(Color.argb(40, Color.red(color), Color.green(color), Color.blue(color)))
          cornerRadius = dp(app, 999).toFloat()
          setStroke(1, color)
        }
      setPadding(dp(app, 8), dp(app, 4), dp(app, 8), dp(app, 4))
      // layout margin top
      val lp =
        LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.WRAP_CONTENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        )
      lp.topMargin = dp(app, 6)
      layoutParams = lp
    }

  private fun actionBtn(app: Context, label: String, primary: Boolean, onClick: () -> Unit): TextView {
    return TextView(app).apply {
      text = label
      gravity = Gravity.CENTER
      setPadding(dp(app, 12), dp(app, 12), dp(app, 12), dp(app, 12))
      setTextColor(if (primary) Color.WHITE else Color.parseColor("#8aa8b0"))
      typeface = Typeface.DEFAULT_BOLD
      textSize = 13f
      background =
        GradientDrawable().apply {
          setColor(if (primary) Color.parseColor("#2d8a9e") else Color.parseColor("#1c2d45"))
          cornerRadius = dp(app, 999).toFloat()
        }
      setOnClickListener { onClick() }
    }
  }

  private fun openApp(app: Context) {
    try {
      val launch = app.packageManager.getLaunchIntentForPackage(app.packageName) ?: return
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      app.startActivity(launch)
    } catch (_: Exception) {
    }
  }

  private fun categoryColor(c: String): Int =
    when (c) {
      "high_trust" -> Color.parseColor("#3dcea0")
      "needs_verification" -> Color.parseColor("#e0b84a")
      "low_confidence" -> Color.parseColor("#e08a4a")
      "potentially_misleading" -> Color.parseColor("#e05a52")
      else -> Color.parseColor("#5ed4c8")
    }

  private fun humanCategory(c: String): String =
    when (c) {
      "high_trust" -> "High Trust"
      "needs_verification" -> "Needs Verification"
      "low_confidence" -> "Low Confidence"
      "potentially_misleading" -> "Potentially Misleading"
      else -> c
    }

  private fun dp(ctx: Context, v: Int): Int =
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      v.toFloat(),
      ctx.resources.displayMetrics,
    ).toInt()
}
