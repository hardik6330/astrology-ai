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
        "handCount" to result.landmarks().size,
        "width" to w,
        "height" to h
      )
    }
  }
}
