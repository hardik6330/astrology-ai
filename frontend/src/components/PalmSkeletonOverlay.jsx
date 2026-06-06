// Frozen MediaPipe hand-skeleton overlay, drawn over the palm photo during the
// scan animation. The gate already detected the 21 landmarks at upload time, so
// we pin them on the still image (there's no live video stream here) and let the
// sweeping scan line supply the motion. Pure SVG with a viewBox in image-pixel
// space, so it scales to whatever size the photo renders at — no canvas sizing
// math, no redraw on resize.
//
// `landmarks` = { keypoints: [{x, y}…], imgW, imgH } from gatePalmImage().

// MediaPipe Hands connection map: wrist (0) + 4 points per finger.
const BONES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky
  [0, 17], // palm base
];

export default function PalmSkeletonOverlay({ landmarks }) {
  const pts = landmarks?.keypoints;
  const w = landmarks?.imgW;
  const h = landmarks?.imgH;
  if (!pts || pts.length < 21 || !w || !h) return null;

  // Sizes are in viewBox (image-pixel) units; the SVG scales them to the
  // rendered photo, so they stay visually proportional at any display size.
  const dot = Math.max(4, w / 90);
  const bone = Math.max(2, w / 170);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full animate-[skeletonIn_0.5s_ease-out]"
    >
      <g stroke="rgba(168,85,247,0.9)" strokeWidth={bone} strokeLinecap="round">
        {BONES.map(([a, b], i) =>
          pts[a] && pts[b] ? <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} /> : null
        )}
      </g>
      {/* Landmark dots breathe gently so the frozen skeleton still feels alive. */}
      <g className="animate-pulse">
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={dot} fill="#c084fc" />
        ))}
      </g>
      <style>{`@keyframes skeletonIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </svg>
  );
}
