// Stub for @mediapipe/hands. The `hand-pose-detection` package statically
// imports `Hands` from this module so it can offer a 'mediapipe' runtime —
// but we always use `runtime: 'tfjs'`, so this import is never actually
// invoked at runtime. Providing this stub via a Vite alias keeps the
// rollup build happy without shipping the ~2MB mediapipe bundle.
export class Hands {
  constructor() {
    throw new Error(
      "MediaPipe runtime is not used in this app. Use runtime: 'tfjs' on createDetector instead.",
    );
  }
}
export default { Hands };
