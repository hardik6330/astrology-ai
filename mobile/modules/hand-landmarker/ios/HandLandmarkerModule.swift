import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

// Native MediaPipe HandLandmarker (still-image mode) for iOS. Mirrors the
// Android module: returns the 21 landmarks in image-PIXEL coordinates so the
// backend embedding is consistent with the web gate.
public class HandLandmarkerModule: Module {

  private var landmarker: HandLandmarker?

  private func detector() throws -> HandLandmarker {
    if let existing = landmarker { return existing }

    guard let modelPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task")
      ?? Bundle(for: HandLandmarkerModule.self).path(forResource: "hand_landmarker", ofType: "task") else {
      throw NSError(domain: "HandLandmarker", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "hand_landmarker.task not found in bundle"])
    }

    let options = HandLandmarkerOptions()
    options.baseOptions.modelAssetPath = modelPath
    options.runningMode = .image
    options.numHands = 2
    options.minHandDetectionConfidence = 0.5
    options.minHandPresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5

    let created = try HandLandmarker(options: options)
    landmarker = created
    return created
  }

  // Load a UIImage from a file:// URI, normalizing orientation so landmarks
  // align with the displayed photo.
  private func loadImage(_ uri: String) throws -> UIImage {
    guard let url = URL(string: uri),
          let data = try? Data(contentsOf: url),
          let raw = UIImage(data: data) else {
      throw NSError(domain: "HandLandmarker", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Could not load image at \(uri)"])
    }
    // Redraw to bake in the orientation (UIImage.imageOrientation otherwise
    // stays a flag that MPImage ignores).
    guard raw.imageOrientation != .up else { return raw }
    UIGraphicsBeginImageContextWithOptions(raw.size, false, raw.scale)
    raw.draw(in: CGRect(origin: .zero, size: raw.size))
    let normalized = UIGraphicsGetImageFromCurrentImageContext() ?? raw
    UIGraphicsEndImageContext()
    return normalized
  }

  // Pixel quality metrics on a 256px-wide downsample so the numbers line up
  // with the WEB gate (which measures on a 256px downsample) and its thresholds
  // (MIN_LAPLACIAN_VAR / MIN_LUMINANCE) transfer directly.
  //   sharpness  = variance of a 3x3 Laplacian over grayscale (low → blurry)
  //   brightness = mean luma 0..255 (low → too dark to read)
  private func computeQuality(_ image: UIImage) -> (Double, Double) {
    let targetW = 256
    let scale = CGFloat(targetW) / max(image.size.width, 1)
    let targetH = max(Int(image.size.height * scale), 1)
    let size = CGSize(width: targetW, height: targetH)

    UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
    image.draw(in: CGRect(origin: .zero, size: size))
    let scaled = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    guard let cg = scaled?.cgImage else { return (0, 0) }

    let w = cg.width
    let h = cg.height
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
      space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return (0, 0) }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

    var gray = [Double](repeating: 0, count: w * h)
    var lumaSum = 0.0
    for i in 0 ..< (w * h) {
      let r = Double(pixels[i * 4])
      let g = Double(pixels[i * 4 + 1])
      let b = Double(pixels[i * 4 + 2])
      let y = 0.299 * r + 0.587 * g + 0.114 * b
      gray[i] = y
      lumaSum += y
    }
    let brightness = lumaSum / Double(w * h)

    var sum = 0.0, sqSum = 0.0, n = 0
    for y in 1 ..< (h - 1) {
      for x in 1 ..< (w - 1) {
        let idx = y * w + x
        let lap = gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
        sum += lap
        sqSum += lap * lap
        n += 1
      }
    }
    let mean = n > 0 ? sum / Double(n) : 0
    let variance = n > 0 ? (sqSum / Double(n)) - (mean * mean) : 0
    return (variance, brightness)
  }

  public func definition() -> ModuleDefinition {
    Name("HandLandmarker")

    // Build the detector (loads the model) without running inference.
    AsyncFunction("prepare") { () -> Bool in
      _ = try self.detector()
      return true
    }

    AsyncFunction("detect") { (uri: String) -> [String: Any] in
      let image = try self.loadImage(uri)
      let w = Double(image.size.width * image.scale)
      let h = Double(image.size.height * image.scale)

      let mpImage = try MPImage(uiImage: image)
      let result = try self.detector().detect(image: mpImage)

      // Pixel quality (blur + darkness) — computed natively; JS has no pixel
      // access on-device. Always returned, even when no hand is found.
      let (sharpness, brightness) = self.computeQuality(image)

      var points: [[String: Double]] = []
      var handedness: String? = nil
      var score = 0.0

      if let hand = result.landmarks.first {
        // Extract handedness and score if available
        if let firstHandedness = result.handedness.first?.first {
          handedness = firstHandedness.categoryName
          score = Double(firstHandedness.score)
        }

        // MediaPipe returns NORMALIZED coords (0..1) → multiply to pixels to
        // match the web gate's coordinate space.
        points = hand.map { lm in
          [
            "x": Double(lm.x) * w,
            "y": Double(lm.y) * h,
            "z": Double(lm.z)
          ]
        }
      }

      return [
        "landmarks": points,
        "handedness": handedness as Any,
        "score": score,
        "sharpness": sharpness,
        "brightness": brightness,
        "handCount": result.landmarks.count,
        "width": w,
        "height": h
      ]
    }
  }
}
