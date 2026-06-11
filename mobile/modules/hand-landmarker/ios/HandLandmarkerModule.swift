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
        "handCount": result.landmarks.count,
        "width": w,
        "height": h
      ]
    }
  }
}
