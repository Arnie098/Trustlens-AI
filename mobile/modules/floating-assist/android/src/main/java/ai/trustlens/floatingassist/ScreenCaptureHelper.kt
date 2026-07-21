package ai.trustlens.floatingassist

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import android.util.DisplayMetrics
import android.view.WindowManager
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Single-frame screen capture using an already-created [MediaProjection].
 * Caller must create MediaProjection while an Activity is still in the foreground,
 * then ideally reveal the target app (e.g. Facebook) before calling [captureFrame].
 */
object ScreenCaptureHelper {
  private const val TIMEOUT_MS = 10_000L

  fun captureFrame(context: Context, projection: MediaProjection): String {
    val metrics = DisplayMetrics()
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(metrics)

    val width = metrics.widthPixels.coerceAtLeast(1)
    val height = metrics.heightPixels.coerceAtLeast(1)
    val density = metrics.densityDpi

    val thread = HandlerThread("TrustLensCapture").apply { start() }
    val handler = Handler(thread.looper)
    val latch = CountDownLatch(1)
    val outPath = AtomicReference<String?>(null)
    val error = AtomicReference<Exception?>(null)

    var virtualDisplay: VirtualDisplay? = null
    var imageReader: ImageReader? = null
    var gotFrame = false

    val callback =
      object : MediaProjection.Callback() {
        override fun onStop() {
          if (!gotFrame) {
            error.compareAndSet(
              null,
              IllegalStateException("Screen capture was stopped before a frame arrived."),
            )
            latch.countDown()
          }
        }
      }

    try {
      projection.registerCallback(callback, handler)

      imageReader =
        ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3).also { reader ->
          reader.setOnImageAvailableListener(
            { r ->
              if (gotFrame) return@setOnImageAvailableListener
              var image: Image? = null
              try {
                image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
                // Skip first possibly-black frame on some devices
                val bitmap = imageToBitmap(image)
                // Prefer a non-trivial frame (not pure black)
                if (isMostlyBlack(bitmap) && outPath.get() == null) {
                  // Keep waiting for a better frame once
                  bitmap.recycle()
                  return@setOnImageAvailableListener
                }
                gotFrame = true
                val file = saveJpeg(context, bitmap)
                bitmap.recycle()
                outPath.set(file.absolutePath)
                latch.countDown()
              } catch (e: Exception) {
                error.set(e)
                latch.countDown()
              } finally {
                try {
                  image?.close()
                } catch (_: Exception) {
                }
              }
            },
            handler,
          )
        }

      virtualDisplay =
        projection.createVirtualDisplay(
          "VeriSphereCapture",
          width,
          height,
          density,
          DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
          imageReader!!.surface,
          null,
          handler,
        )

      val ok = latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS)
      if (!ok) {
        // Last chance: try one more acquire
        try {
          val img = imageReader?.acquireLatestImage()
          if (img != null) {
            try {
              val bitmap = imageToBitmap(img)
              val file = saveJpeg(context, bitmap)
              bitmap.recycle()
              return file.absolutePath
            } finally {
              img.close()
            }
          }
        } catch (_: Exception) {
        }
        throw IllegalStateException(
          "Timed out waiting for screen frame. Grant screen capture and try again while Facebook is open.",
        )
      }
      error.get()?.let { throw it }
      return outPath.get()
        ?: throw IllegalStateException("No screen frame was captured.")
    } finally {
      try {
        virtualDisplay?.release()
      } catch (_: Exception) {
      }
      try {
        imageReader?.close()
      } catch (_: Exception) {
      }
      try {
        projection.unregisterCallback(callback)
      } catch (_: Exception) {
      }
      try {
        projection.stop()
      } catch (_: Exception) {
      }
      try {
        thread.quitSafely()
      } catch (_: Exception) {
      }
      CaptureResultStore.clearConsent()
    }
  }

  private fun isMostlyBlack(bitmap: Bitmap): Boolean {
    val step = 40
    var dark = 0
    var total = 0
    var y = 0
    while (y < bitmap.height) {
      var x = 0
      while (x < bitmap.width) {
        val c = bitmap.getPixel(x, y)
        val r = (c shr 16) and 0xFF
        val g = (c shr 8) and 0xFF
        val b = c and 0xFF
        if (r + g + b < 30) dark++
        total++
        x += step
      }
      y += step
    }
    return total > 0 && dark * 100 / total > 92
  }

  private fun imageToBitmap(image: Image): Bitmap {
    val plane = image.planes[0]
    val buffer = plane.buffer
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    val rowPadding = rowStride - pixelStride * image.width
    val bitmap =
      Bitmap.createBitmap(
        image.width + rowPadding / pixelStride,
        image.height,
        Bitmap.Config.ARGB_8888,
      )
    bitmap.copyPixelsFromBuffer(buffer)
    return if (rowPadding == 0) {
      bitmap
    } else {
      val cropped = Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
      if (cropped !== bitmap) bitmap.recycle()
      cropped
    }
  }

  private fun saveJpeg(context: Context, bitmap: Bitmap): File {
    val dir = File(context.cacheDir, "screen-captures").apply { mkdirs() }
    val file = File(dir, "capture-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { out ->
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out)) {
        throw IllegalStateException("Failed to encode screen capture.")
      }
    }
    CaptureResultStore.lastCapturePath = file.absolutePath
    return file
  }
}
