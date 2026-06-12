package com.astrologyai.handlandmarker

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Native MediaPipe HandLandmarker (still-image mode). One detector instance is
// memoized — building it loads the .task model (~7 MB) and is the slow part;
// detect() per photo is fast. The model file lives in this module's
// android/src/main/assets/hand_landmarker.task and is referenced by asset path.
class HandLandmarkerModule : Module() {

  private var landmarker: HandLandmarker? = null

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun detector(): HandLandmarker {
    landmarker?.let { return it }
    val options = HandLandmarker.HandLandmarkerOptions.builder()
      .setBaseOptions(
        BaseOptions.builder()
          .setModelAssetPath("hand_landmarker.task")
          .build()
      )
      .setRunningMode(RunningMode.IMAGE)
      .setNumHands(2)
      .setMinHandDetectionConfidence(0.5f)
      .setMinHandPresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()
    return HandLandmarker.createFromOptions(context, options).also { landmarker = it }
  }

  // Decode the picked photo, honoring EXIF orientation so landmarks line up with
  // what the user sees (image-picker JPEGs can carry a rotation flag).
  private fun decodeOriented(uri: String): Bitmap {
    val parsed = Uri.parse(uri)
    val bitmap = context.contentResolver.openInputStream(parsed).use { input ->
      BitmapFactory.decodeStream(input)
        ?: throw IllegalArgumentException("Could not decode image at $uri")
    }
    val orientation = context.contentResolver.openInputStream(parsed).use { input ->
      input?.let { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
        ?: ExifInterface.ORIENTATION_NORMAL
    }
    val degrees = when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val m = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
  }

  // Pixel quality metrics, computed on a 256px-wide downsample so the numbers
  // are comparable to the WEB gate (which measures on a 256px downsample) and
  // its thresholds (MIN_LAPLACIAN_VAR / MIN_LUMINANCE) transfer directly.
  //   sharpness  = variance of a 3x3 Laplacian over the grayscale image (blur:
  //                a flat/out-of-focus photo has low edge energy → low variance)
  //   brightness = mean luma (0..255); too low → the photo is too dark to read
  private fun computeQuality(src: Bitmap): Pair<Double, Double> {
    val targetW = 256
    val scale = targetW.toDouble() / src.width
    val targetH = (src.height * scale).toInt().coerceAtLeast(1)
    val small = Bitmap.createScaledBitmap(src, targetW, targetH, true)
    val w = small.width
    val h = small.height
    val pixels = IntArray(w * h)
    small.getPixels(pixels, 0, w, 0, 0, w, h)

    val gray = DoubleArray(w * h)
    var lumaSum = 0.0
    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16) and 0xFF
      val g = (p shr 8) and 0xFF
      val b = p and 0xFF
      val y = 0.299 * r + 0.587 * g + 0.114 * b
      gray[i] = y
      lumaSum += y
    }
    val brightness = lumaSum / (w * h)

    // Laplacian [0,1,0; 1,-4,1; 0,1,0] variance over interior pixels.
    var sum = 0.0
    var sqSum = 0.0
    var n = 0
    for (y in 1 until h - 1) {
      for (x in 1 until w - 1) {
        val idx = y * w + x
        val lap = gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
        sum += lap
        sqSum += lap * lap
        n++
      }
    }
    val mean = if (n > 0) sum / n else 0.0
    val variance = if (n > 0) (sqSum / n) - (mean * mean) else 0.0
    return Pair(variance, brightness)
  }

  override fun definition() = ModuleDefinition {
    Name("HandLandmarker")

    // Build the detector (loads the model) without running inference, so the
    // first real detect() isn't paying the model-load cost.
    AsyncFunction("prepare") {
      detector()
      true
    }

    AsyncFunction("detect") { uri: String ->
      val bitmap = decodeOriented(uri)
      val w = bitmap.width
      val h = bitmap.height
      val result = detector().detect(BitmapImageBuilder(bitmap).build())

      // Pixel quality (blur + darkness) — computed natively since JS has no
      // pixel access on-device. Always returned, even when no hand is found.
      val (sharpness, brightness) = computeQuality(bitmap)

      // MediaPipe returns NORMALIZED coords (0..1). Multiply by width/height so
      // the payload is in pixel space — matching the web gate, which keeps the
      // backend embedding consistent across platforms.
      var handedness: String? = null
      var score = 0.0
      val points = if (result.landmarks().isEmpty()) {
        emptyList<Map<String, Double>>()
      } else {
        // Extract handedness and score if available
        if (result.handedness().isNotEmpty() && result.handedness()[0].isNotEmpty()) {
          handedness = result.handedness()[0][0].categoryName()
          score = result.handedness()[0][0].score().toDouble()
        }

        result.landmarks()[0].map { lm ->
          mapOf(
            "x" to (lm.x() * w).toDouble(),
            "y" to (lm.y() * h).toDouble(),
            "z" to lm.z().toDouble()
          )
        }
      }

      mapOf(
        "landmarks" to points,
        "handedness" to handedness,
        "score" to score,
        "sharpness" to sharpness,
        "brightness" to brightness,
        "handCount" to result.landmarks().size,
        "width" to w,
        "height" to h
      )
    }
  }
}
