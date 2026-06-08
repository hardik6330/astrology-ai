import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Line, Circle, G } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";

// MediaPipe Hands connection map: wrist (0) + 4 points per finger.
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],     // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],     // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

export default function PalmSkeletonOverlay({ landmarks }) {
  const pts = landmarks?.keypoints || landmarks; // landmarks might be the array itself
  const w = landmarks?.imgW;
  const h = landmarks?.imgH;

  if (!pts || pts.length < 21 || !w || !h) return null;

  // Sizes are proportional to the image dimensions
  const dotSize = Math.max(2, w / 120);
  const boneWidth = Math.max(1.5, w / 200);

  return (
    <Animated.View 
      entering={FadeIn.duration(500)}
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
      pointerEvents="none"
    >
      <Svg
        viewBox={`0 0 ${w} ${h}`}
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid meet"
      >
        <G stroke="rgba(168, 85, 247, 0.8)" strokeWidth={boneWidth} strokeLinecap="round">
          {BONES.map(([a, b], i) => {
            const p1 = pts[a];
            const p2 = pts[b];
            if (!p1 || !p2) return null;
            return (
              <Line
                key={`bone-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
              />
            );
          })}
        </G>
        <G>
          {pts.map((p, i) => (
            <Circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={dotSize}
              fill="#c084fc"
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}
