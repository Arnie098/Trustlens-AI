package ai.trustlens.floatingassist

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
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
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Pipeline stages shown in the floating loading card. */
enum class AnalyzeLoadStage(val index: Int, val title: String, val glyph: String) {
  CAPTURE(0, "Capturing screen", "◎"),
  PREPARE(1, "Preparing image", "▣"),
  UPLOAD(2, "Uploading screenshot", "⬆"),
  VISION(3, "AI vision analysis", "◉"),
  FINISH(4, "Finishing up", "✦"),
}

/**
 * Floating result card over other apps (Facebook, etc.).
 * Dense, scannable MIL card — not a wall of generic prose.
 *
 * Results stay until the user taps Close / Done (no auto-dismiss).
 * Past checks are available via History.
 */
object FloatingResultOverlay {
  private val main = Handler(Looper.getMainLooper())
  private var windowManager: WindowManager? = null
  private var panel: View? = null

  // Live loading-status widgets (updated while analyze runs)
  private var loadStageTitle: TextView? = null
  private var loadDetail: TextView? = null
  private var loadElapsed: TextView? = null
  private var loadPercent: TextView? = null
  private var loadPhaseBadge: TextView? = null
  private var loadTrackFill: View? = null
  private var loadTrackFillLp: LinearLayout.LayoutParams? = null
  private var loadOrbit: OrbitRingView? = null
  private var loadStepRows: List<LinearLayout> = emptyList()
  private var loadStepLabels: List<TextView> = emptyList()
  private var loadStepDots: List<View> = emptyList()
  private var loadStartedAtMs: Long = 0L
  private var loadTick: Runnable? = null
  private var loadActive = false
  private var loadPulse: ObjectAnimator? = null
  private var loadCurrentStage: AnalyzeLoadStage = AnalyzeLoadStage.CAPTURE

  private val LOAD_STEPS =
    listOf(
      "Capture",
      "Prepare",
      "Upload",
      "Vision",
      "Finish",
    )

  fun showAnalyzing(
    ctx: Context,
    stage: AnalyzeLoadStage = AnalyzeLoadStage.CAPTURE,
    detail: String = "Starting…",
  ) {
    main.post {
      val app = ctx.applicationContext
      ensureWm(app)
      stopLoadTicker()
      removePanel()
      loadActive = true
      loadStartedAtMs = System.currentTimeMillis()
      loadCurrentStage = stage

      val root = card(app)

      // Top brand strip
      root.addView(
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          addView(
            TextView(app).apply {
              text = "VERISPHERE AI"
              setTextColor(Color.parseColor("#5ed4c8"))
              textSize = 10f
              typeface = Typeface.DEFAULT_BOLD
              letterSpacing = 0.14f
            },
          )
          addView(
            TextView(app).apply {
              text = "  ·  LIVE PIPELINE"
              setTextColor(Color.parseColor("#6a8494"))
              textSize = 10f
              letterSpacing = 0.08f
            },
          )
        },
      )

      // Hero: orbit + percent
      val hero =
        FrameLayout(app).apply {
          layoutParams =
            LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              dp(app, 118),
            ).apply { topMargin = dp(app, 10); bottomMargin = dp(app, 6) }
        }
      val orbit =
        OrbitRingView(app).apply {
          layoutParams =
            FrameLayout.LayoutParams(dp(app, 96), dp(app, 96), Gravity.CENTER)
        }
      loadOrbit = orbit
      hero.addView(orbit)

      val centerStack =
        LinearLayout(app).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          layoutParams =
            FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
              Gravity.CENTER,
            )
        }
      val pct =
        TextView(app).apply {
          text = "${stageProgress(stage)}%"
          setTextColor(Color.WHITE)
          textSize = 22f
          typeface = Typeface.DEFAULT_BOLD
          gravity = Gravity.CENTER
        }
      loadPercent = pct
      centerStack.addView(pct)
      centerStack.addView(
        TextView(app).apply {
          text = "SIGNAL"
          setTextColor(Color.parseColor("#5ed4c8"))
          textSize = 9f
          letterSpacing = 0.16f
          gravity = Gravity.CENTER
          typeface = Typeface.DEFAULT_BOLD
        },
      )
      hero.addView(centerStack)
      root.addView(hero)

      // Phase badge
      val badge =
        TextView(app).apply {
          text = "  ${stage.glyph}  ${stage.title.uppercase()}  "
          setTextColor(Color.parseColor("#0a1424"))
          textSize = 11f
          typeface = Typeface.DEFAULT_BOLD
          letterSpacing = 0.04f
          setPadding(dp(app, 12), dp(app, 7), dp(app, 12), dp(app, 7))
          background =
            GradientDrawable().apply {
              colors = intArrayOf(Color.parseColor("#5ed4c8"), Color.parseColor("#2d8a9e"))
              orientation = GradientDrawable.Orientation.LEFT_RIGHT
              cornerRadius = dp(app, 999).toFloat()
            }
          layoutParams =
            LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
              gravity = Gravity.CENTER_HORIZONTAL
              bottomMargin = dp(app, 8)
            }
        }
      loadPhaseBadge = badge
      root.addView(badge)
      loadPulse =
        ObjectAnimator.ofFloat(badge, View.ALPHA, 1f, 0.55f, 1f).apply {
          duration = 1400
          repeatCount = ValueAnimator.INFINITE
          interpolator = AccelerateDecelerateInterpolator()
          start()
        }

      val stageTitle =
        TextView(app).apply {
          text = stage.title
          setTextColor(Color.WHITE)
          textSize = 16f
          typeface = Typeface.DEFAULT_BOLD
          gravity = Gravity.CENTER
          setPadding(0, 0, 0, dp(app, 4))
        }
      loadStageTitle = stageTitle
      root.addView(stageTitle)

      val detailTv =
        TextView(app).apply {
          text = detail
          setTextColor(Color.parseColor("#b8cdd6"))
          textSize = 12f
          gravity = Gravity.CENTER
          setLineSpacing(2f, 1.2f)
          setPadding(dp(app, 4), 0, dp(app, 4), dp(app, 12))
        }
      loadDetail = detailTv
      root.addView(detailTv)

      // Gradient progress track
      root.addView(buildFancyTrack(app, stageProgress(stage)))

      val elapsed =
        TextView(app).apply {
          text = "⏱  0:00  ·  warming pipeline"
          setTextColor(Color.parseColor("#8aa8b0"))
          textSize = 11f
          gravity = Gravity.CENTER
          setPadding(0, dp(app, 10), 0, dp(app, 12))
        }
      loadElapsed = elapsed
      root.addView(elapsed)

      // Horizontal step rail
      root.addView(
        TextView(app).apply {
          text = "PIPELINE"
          setTextColor(Color.parseColor("#5ed4c8"))
          textSize = 9f
          typeface = Typeface.DEFAULT_BOLD
          letterSpacing = 0.18f
          setPadding(0, 0, 0, dp(app, 8))
        },
      )
      root.addView(buildStepRail(app, stage.index))

      root.addView(
        TextView(app).apply {
          text = "Stay on Facebook · result stays open until you tap Close"
          setTextColor(Color.parseColor("#6a8494"))
          textSize = 10f
          gravity = Gravity.CENTER
          setPadding(0, dp(app, 12), 0, 0)
        },
      )

      addPanel(app, wrapScroll(app, root))
      startLoadTicker()
      orbit.startSpin()
    }
  }

  /** Update the existing loading card without rebuilding (smooth status). */
  fun updateAnalyzing(ctx: Context, stage: AnalyzeLoadStage, detail: String) {
    main.post {
      if (!loadActive || panel == null) {
        showAnalyzing(ctx, stage, detail)
        return@post
      }
      loadCurrentStage = stage
      val p = stageProgress(stage)
      loadStageTitle?.text = stage.title
      loadDetail?.text = detail
      loadPercent?.text = "$p%"
      loadPhaseBadge?.text = "  ${stage.glyph}  ${stage.title.uppercase()}  "
      loadTrackFillLp?.weight = p.coerceIn(1, 100).toFloat()
      loadTrackFill?.requestLayout()
      loadOrbit?.setProgress(p / 100f)
      refreshStepRail(stage.index)
      CaptureNotifier.showProgress(
        ctx.applicationContext,
        stage.title,
        detail.take(80),
      )
    }
  }

  private fun buildFancyTrack(app: Context, progress: Int): View {
    val outer =
      LinearLayout(app).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(0, dp(app, 2), 0, dp(app, 2))
      }
    val track =
      LinearLayout(app).apply {
        orientation = LinearLayout.HORIZONTAL
        weightSum = 100f
        background =
          GradientDrawable().apply {
            setColor(Color.parseColor("#0a1628"))
            cornerRadius = dp(app, 999).toFloat()
            setStroke(dp(app, 1), Color.parseColor("#243a52"))
          }
        layoutParams =
          LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(app, 10),
          )
      }
    val fillLp =
      LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, progress.coerceIn(1, 100).toFloat())
    val fill =
      View(app).apply {
        background =
          GradientDrawable().apply {
            colors =
              intArrayOf(
                Color.parseColor("#2d8a9e"),
                Color.parseColor("#5ed4c8"),
                Color.parseColor("#3dcea0"),
              )
            orientation = GradientDrawable.Orientation.LEFT_RIGHT
            cornerRadius = dp(app, 999).toFloat()
          }
        layoutParams = fillLp
      }
    loadTrackFill = fill
    loadTrackFillLp = fillLp
    track.addView(fill)
    if (progress < 100) {
      track.addView(
        View(app).apply {
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, (100 - progress).toFloat())
        },
      )
    }
    outer.addView(track)
    return outer
  }

  private fun buildStepRail(app: Context, current: Int): LinearLayout {
    val rail =
      LinearLayout(app).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        weightSum = LOAD_STEPS.size.toFloat()
      }
    val rows = mutableListOf<LinearLayout>()
    val labels = mutableListOf<TextView>()
    val dots = mutableListOf<View>()
    LOAD_STEPS.forEachIndexed { i, name ->
      val col =
        LinearLayout(app).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER_HORIZONTAL
          layoutParams =
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
      val dotSize = dp(app, 14)
      val dot =
        View(app).apply {
          layoutParams = LinearLayout.LayoutParams(dotSize, dotSize)
          background = stepDotDrawable(app, i, current)
        }
      val lab =
        TextView(app).apply {
          text = name
          textSize = 9f
          gravity = Gravity.CENTER
          typeface = Typeface.DEFAULT_BOLD
          setTextColor(stepColor(i, current))
          setPadding(0, dp(app, 5), 0, 0)
        }
      col.addView(dot)
      col.addView(lab)
      // connector line after each except last — simplified: just columns
      rows.add(col)
      labels.add(lab)
      dots.add(dot)
      rail.addView(col)
    }
    loadStepRows = rows
    loadStepLabels = labels
    loadStepDots = dots
    return rail
  }

  private fun refreshStepRail(current: Int) {
    loadStepLabels.forEachIndexed { i, tv ->
      tv.setTextColor(stepColor(i, current))
    }
    loadStepDots.forEachIndexed { i, v ->
      val app = v.context
      v.background = stepDotDrawable(app, i, current)
    }
  }

  private fun stepDotDrawable(app: Context, i: Int, current: Int): GradientDrawable =
    GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      when {
        i < current -> {
          setColor(Color.parseColor("#3dcea0"))
          setStroke(0, Color.TRANSPARENT)
        }
        i == current -> {
          setColor(Color.parseColor("#5ed4c8"))
          setStroke(dp(app, 2), Color.parseColor("#a8fff4"))
        }
        else -> {
          setColor(Color.parseColor("#1c2d45"))
          setStroke(dp(app, 1), Color.parseColor("#3a5068"))
        }
      }
    }

  private fun stageProgress(stage: AnalyzeLoadStage): Int =
    when (stage) {
      AnalyzeLoadStage.CAPTURE -> 14
      AnalyzeLoadStage.PREPARE -> 32
      AnalyzeLoadStage.UPLOAD -> 52
      AnalyzeLoadStage.VISION -> 78
      AnalyzeLoadStage.FINISH -> 94
    }

  private fun stepColor(i: Int, current: Int): Int =
    when {
      i < current -> Color.parseColor("#3dcea0")
      i == current -> Color.parseColor("#5ed4c8")
      else -> Color.parseColor("#6a8494")
    }

  private fun startLoadTicker() {
    stopLoadTicker()
    val tick =
      object : Runnable {
        override fun run() {
          if (!loadActive) return
          val sec = ((System.currentTimeMillis() - loadStartedAtMs) / 1000L).coerceAtLeast(0)
          val mm = sec / 60
          val ss = sec % 60
          val clock = "%d:%02d".format(mm, ss)
          val hint =
            when {
              sec < 15 -> "warming pipeline"
              sec < 40 -> "syncing capture"
              sec < 90 -> "AI reading pixels"
              sec < 150 -> "deep vision pass"
              else -> "cold start · hang tight"
            }
          // Soft pulse on percent while vision runs
          val base = stageProgress(loadCurrentStage)
          val breathe = if (loadCurrentStage == AnalyzeLoadStage.VISION) {
            ((sec % 4) * 2).toInt() // 0..6
          } else 0
          loadPercent?.text = "${(base + breathe).coerceAtMost(99)}%"
          loadElapsed?.text = "⏱  $clock  ·  $hint"
          loadTick = this
          main.postDelayed(this, 1000)
        }
      }
    loadTick = tick
    main.post(tick)
  }

  private fun stopLoadTicker() {
    loadTick?.let { main.removeCallbacks(it) }
    loadTick = null
    loadActive = false
    loadPulse?.cancel()
    loadPulse = null
    loadOrbit?.stopSpin()
  }

  /** Animated lens ring — VeriSphere “signal lock” aesthetic. */
  private class OrbitRingView(context: Context) : View(context) {
    private val trackPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpF(3f)
        color = Color.parseColor("#1c2d45")
        strokeCap = Paint.Cap.ROUND
      }
    private val arcPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpF(4.5f)
        strokeCap = Paint.Cap.ROUND
      }
    private val glowPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpF(10f)
        color = Color.parseColor("#335ed4c8")
        strokeCap = Paint.Cap.ROUND
      }
    private val tickPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpF(1.5f)
        color = Color.parseColor("#3a6070")
      }
    private val oval = RectF()
    private var rotationDeg = 0f
    private var progress = 0.14f
    private var spin: ValueAnimator? = null

    fun startSpin() {
      spin?.cancel()
      spin =
        ValueAnimator.ofFloat(0f, 360f).apply {
          duration = 2200
          repeatCount = ValueAnimator.INFINITE
          interpolator = LinearInterpolator()
          addUpdateListener {
            rotationDeg = it.animatedValue as Float
            invalidate()
          }
          start()
        }
    }

    fun stopSpin() {
      spin?.cancel()
      spin = null
    }

    fun setProgress(p: Float) {
      progress = p.coerceIn(0.08f, 1f)
      invalidate()
    }

    override fun onDraw(canvas: Canvas) {
      val cx = width / 2f
      val cy = height / 2f
      val r = minOf(cx, cy) - dpF(8f)
      oval.set(cx - r, cy - r, cx + r, cy + r)

      // outer ticks (compass / lens reticle)
      for (i in 0 until 24) {
        val a = Math.toRadians((i * 15).toDouble())
        val cos = kotlin.math.cos(a).toFloat()
        val sin = kotlin.math.sin(a).toFloat()
        val inner = if (i % 6 == 0) r - dpF(7f) else r - dpF(4f)
        canvas.drawLine(
          cx + cos * inner,
          cy + sin * inner,
          cx + cos * r,
          cy + sin * r,
          tickPaint,
        )
      }

      canvas.drawCircle(cx, cy, r - dpF(2f), trackPaint)

      val colors =
        intArrayOf(
          Color.parseColor("#002d8a9e"),
          Color.parseColor("#5ed4c8"),
          Color.parseColor("#a8fff4"),
          Color.parseColor("#3dcea0"),
          Color.parseColor("#002d8a9e"),
        )
      arcPaint.shader = SweepGradient(cx, cy, colors, null)

      canvas.save()
      canvas.rotate(rotationDeg - 90f, cx, cy)
      val sweep = 70f + progress * 200f
      canvas.drawArc(oval, 0f, sweep, false, glowPaint)
      canvas.drawArc(oval, 0f, sweep, false, arcPaint)
      canvas.restore()

      // inner core
      val core =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.FILL
          color = Color.parseColor("#101c30")
        }
      canvas.drawCircle(cx, cy, r * 0.55f, core)
      val coreRing =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.STROKE
          strokeWidth = dpF(1f)
          color = Color.parseColor("#2d8a9e")
        }
      canvas.drawCircle(cx, cy, r * 0.55f, coreRing)
    }

    private fun dpF(v: Float): Float =
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
  }

  fun showResult(ctx: Context, result: QuickAnalyzeResult, fromHistory: Boolean = false) {
    main.post {
      stopLoadTicker()
      val app = ctx.applicationContext
      ensureWm(app)
      if (!fromHistory) {
        AnalyzeHistoryStore.add(result)
      }
      removePanel()
      val root = card(app)
      val accent = categoryColor(result.category)

      // Header
      root.addView(
        kicker(
          app,
          if (fromHistory) "VeriSphere AI · history"
          else "VeriSphere AI · quick check",
        ),
      )

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

      // Summary — hero takeaway (scrollable; no auto-close)
      root.addView(sectionTitle(app, "Takeaway"))
      root.addView(
        TextView(app).apply {
          text = result.summary
          setTextColor(Color.WHITE)
          textSize = 14f
          typeface = Typeface.DEFAULT_BOLD
          setLineSpacing(2f, 1.2f)
          setPadding(0, 0, 0, dp(app, 8))
          // Full text — card scrolls; avoid mid-sentence "…"
          maxLines = 40
        },
      )

      if (result.sourceAssessment.isNotBlank()) {
        root.addView(sectionTitle(app, "Source"))
        root.addView(bodyLine(app, result.sourceAssessment, maxLines = 20))
      }
      if (result.contextAnalysis.isNotBlank()) {
        root.addView(sectionTitle(app, "Context"))
        root.addView(bodyLine(app, result.contextAnalysis, maxLines = 20))
      }

      if (result.concerns.isNotEmpty()) {
        root.addView(sectionTitle(app, "Watch for"))
        result.concerns.take(6).forEach { c ->
          root.addView(bullet(app, c, Color.parseColor("#e0b84a")))
        }
      }

      if (result.evidence.isNotEmpty()) {
        root.addView(sectionTitle(app, "Signals"))
        result.evidence.take(6).forEach { e ->
          root.addView(bullet(app, e, Color.parseColor("#5ed4c8")))
        }
      }

      if (result.nextSteps.isNotEmpty()) {
        root.addView(sectionTitle(app, "Do next"))
        result.nextSteps.take(4).forEachIndexed { i, s ->
          root.addView(numberedStep(app, i + 1, s))
        }
      }

      root.addView(
        TextView(app).apply {
          text =
            "Stays open until you tap Close. Signals, not verdicts — double-check before you share."
          setTextColor(Color.parseColor("#6a8494"))
          textSize = 10f
          setPadding(0, dp(app, 10), 0, dp(app, 10))
        },
      )

      // Actions — only close when user taps
      val row =
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
        }
      val histCount = AnalyzeHistoryStore.count()
      row.addView(
        actionBtn(app, if (histCount > 1) "History ($histCount)" else "History", primary = false) {
          showHistory(app)
        },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
          marginEnd = dp(app, 4)
        },
      )
      row.addView(
        actionBtn(app, "Open app", primary = false) {
          openApp(app)
          // Keep the card open so they can return to Facebook and re-read
        },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
          marginStart = dp(app, 4)
          marginEnd = dp(app, 4)
        },
      )
      row.addView(
        actionBtn(app, "Close", primary = true) { dismiss() },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
          marginStart = dp(app, 4)
        },
      )
      root.addView(row)

      addPanel(app, wrapScroll(app, root))
    }
  }

  /** List of past floating checks — re-open any entry; only Close hides. */
  fun showHistory(ctx: Context) {
    main.post {
      stopLoadTicker()
      val app = ctx.applicationContext
      ensureWm(app)
      removePanel()
      val root = card(app)
      root.addView(kicker(app, "VeriSphere AI · history"))
      root.addView(title(app, "Past checks"))

      val items = AnalyzeHistoryStore.all()
      if (items.isEmpty()) {
        root.addView(
          muted(app, "No saved checks yet. Run Analyze on a post — results stay here until you close them."),
        )
      } else {
        root.addView(
          muted(app, "${items.size} saved · tap one to re-read · Close only when you tap the button."),
        )
        items.forEach { entry ->
          root.addView(historyRow(app, entry))
        }
      }

      root.addView(
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
          setPadding(0, dp(app, 12), 0, 0)
          addView(
            actionBtn(app, "Close", primary = true) { dismiss() },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
          )
        },
      )
      addPanel(app, wrapScroll(app, root))
    }
  }

  fun showError(ctx: Context, message: String) {
    main.post {
      stopLoadTicker()
      val app = ctx.applicationContext
      ensureWm(app)
      removePanel()
      val root = card(app)
      root.addView(kicker(app, "VeriSphere AI"))
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
          maxLines = 10
        },
      )
      val row =
        LinearLayout(app).apply {
          orientation = LinearLayout.HORIZONTAL
        }
      if (AnalyzeHistoryStore.count() > 0) {
        row.addView(
          actionBtn(app, "History", primary = false) { showHistory(app) },
          LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(app, 6)
          },
        )
      }
      row.addView(
        actionBtn(app, "Close", primary = true) { dismiss() },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
      )
      root.addView(row)
      addPanel(app, wrapScroll(app, root))
    }
  }

  fun dismiss() {
    main.post {
      stopLoadTicker()
      removePanel()
    }
  }

  private fun removePanelClearingLoadRefs() {
    loadStageTitle = null
    loadDetail = null
    loadElapsed = null
    loadPercent = null
    loadPhaseBadge = null
    loadTrackFill = null
    loadTrackFillLp = null
    loadOrbit = null
    loadStepRows = emptyList()
    loadStepLabels = emptyList()
    loadStepDots = emptyList()
  }

  private fun historyRow(app: Context, entry: AnalyzeHistoryEntry): View {
    val r = entry.result
    val accent = categoryColor(r.category)
    return LinearLayout(app).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(app, 10), dp(app, 10), dp(app, 10), dp(app, 10))
      background =
        GradientDrawable().apply {
          setColor(Color.parseColor("#0a1628"))
          cornerRadius = dp(app, 12).toFloat()
          setStroke(1, Color.parseColor("#243a52"))
        }
      val lp =
        LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        )
      lp.topMargin = dp(app, 8)
      layoutParams = lp

      addView(
        TextView(app).apply {
          text = "${r.trustScore} · ${humanCategory(r.category)} · ${formatWhen(entry.atMs)}"
          setTextColor(accent)
          textSize = 12f
          typeface = Typeface.DEFAULT_BOLD
        },
      )
      addView(
        TextView(app).apply {
          text = r.summary.take(140).let { if (r.summary.length > 140) "$it…" else it }
          setTextColor(Color.parseColor("#d7e6ec"))
          textSize = 12f
          maxLines = 3
          setPadding(0, dp(app, 4), 0, 0)
        },
      )
      setOnClickListener {
        showResult(app, entry.result, fromHistory = true)
      }
    }
  }

  private fun formatWhen(atMs: Long): String {
    val ago = ((System.currentTimeMillis() - atMs) / 1000L).coerceAtLeast(0)
    return when {
      ago < 60 -> "just now"
      ago < 3600 -> "${ago / 60}m ago"
      ago < 86400 -> "${ago / 3600}h ago"
      else -> "${ago / 86400}d ago"
    }
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
    removePanelClearingLoadRefs()
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

  private fun bodyLine(app: Context, t: String, maxLines: Int = 6) =
    TextView(app).apply {
      text = t
      setTextColor(Color.parseColor("#d7e6ec"))
      textSize = 12f
      setLineSpacing(1f, 1.15f)
      this.maxLines = maxLines
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
