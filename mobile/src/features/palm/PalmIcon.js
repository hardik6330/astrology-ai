import React from "react";
import Svg, { Path } from "react-native-svg";
import { color as theme } from "../../theme/tokens";

// Vector palm/hand icon — renders identically on every platform and font.
// Use anywhere we need the "palm reading" glyph instead of an emoji.

export default function PalmIcon({ size = 20, color = theme.warning }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 11V4.5a1.5 1.5 0 1 1 3 0V11M12 11V3.5a1.5 1.5 0 1 1 3 0V11M15 11V5.5a1.5 1.5 0 1 1 3 0V13M9 11V7.5a1.5 1.5 0 1 0-3 0V16c0 3.866 2.686 6 6 6s6-2.134 6-6v-3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
