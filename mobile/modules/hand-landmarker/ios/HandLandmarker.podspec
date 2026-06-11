Pod::Spec.new do |s|
  s.name           = 'HandLandmarker'
  s.version        = '0.1.0'
  s.summary        = 'Native MediaPipe HandLandmarker (still image) for the palm gate.'
  s.description    = 'Returns 21 hand landmarks in image-pixel coordinates from a still photo URI.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # Bundle the MediaPipe model so it ships in the app bundle.
  s.resources = "hand_landmarker.task"
end
