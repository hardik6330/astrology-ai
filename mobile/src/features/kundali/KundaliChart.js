import React from "react";
import { View } from "react-native";
import Svg, { Rect, Line, Polygon, G, Text as SvgText } from "react-native-svg";
import { SIGNS, signOf, nm } from "../../shared/astrology";
import { useTheme } from "../../theme/ThemeContext";

// Theme-aware KundaliChart. Strokes and labels switch shade based on the
// active palette so it reads on both dark and light backgrounds.

const PABBR = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };

const NORTH = [
  { c: [200, 108] }, { c: [100,  42] }, { c: [ 42, 100] }, { c: [100, 208] },
  { c: [ 42, 300] }, { c: [100, 360] }, { c: [200, 308] }, { c: [200, 360] },
  { c: [358, 300] }, { c: [300, 208] }, { c: [358, 100] }, { c: [300,  42] },
];

const SOUTH = {
  Pisces:      [0, 0], Aries:  [1, 0], Taurus:    [2, 0], Gemini:    [3, 0],
  Aquarius:    [0, 1], Cancer: [3, 1], Capricorn: [0, 2], Leo:       [3, 2],
  Sagittarius: [0, 3], Scorpio:[1, 3], Libra:     [2, 3], Virgo:     [3, 3],
};

// Map theme to SVG ink tones. Dark mode → light-on-dark; light mode → ink-on-paper.
function inkFor(theme) {
  return theme === "light"
    ? {
        stroke:      "rgba(15,23,42,0.18)",
        strokeSoft:  "rgba(15,23,42,0.08)",
        labelFill:   "rgba(15,23,42,0.55)",
        planetFill:  "#0f172a",
        ascFill:     "rgba(124, 58, 237, 0.10)",
      }
    : {
        stroke:      "rgba(255,255,255,0.18)",
        strokeSoft:  "rgba(255,255,255,0.07)",
        labelFill:   "rgba(255,255,255,0.45)",
        planetFill:  "#ffffff",
        ascFill:     "rgba(99, 102, 241, 0.12)",
      };
}

function PlanetStack({ planets, cx, cy, inkColor }) {
  return planets.map((p, j) => (
    <SvgText
      key={j}
      x={cx}
      y={cy + j * 13 - (planets.length - 1) * 6.5}
      fontSize="11.5"
      fill={p.retro ? "#ef4444" : inkColor}
      textAnchor="middle"
    >
      {PABBR[p.base]}
    </SvgText>
  ));
}

export default function KundaliChart({ chart, variant = "north" }) {
  const { theme } = useTheme();
  const ink = inkFor(theme);

  const grahas = chart.planets.filter((p) => PABBR[p.base]);
  const ascSign = Math.floor(nm(chart.angles.ascSid) / 30);

  if (variant === "north") {
    const byHouse = {};
    grahas.forEach((p) => { (byHouse[p.houseSid] = byHouse[p.houseSid] || []).push(p); });

    return (
      <View style={{ alignItems: "center" }}>
        <Svg viewBox="0 0 400 400" width="100%" height={330} style={{ maxWidth: 330 }}>
          <Rect x="1" y="1" width="398" height="398" fill="none" stroke={ink.stroke} strokeWidth="2" />
          <Line x1="0" y1="0" x2="400" y2="400" stroke={ink.strokeSoft} strokeWidth="1.5" />
          <Line x1="400" y1="0" x2="0" y2="400" stroke={ink.strokeSoft} strokeWidth="1.5" />
          <Polygon points="200,0 400,200 200,400 0,200" fill="none" stroke={ink.stroke} strokeWidth="1.5" />
          {NORTH.map((h, i) => {
            const signNum = ((ascSign + i) % 12) + 1;
            const ps = byHouse[i + 1] || [];
            return (
              <G key={i}>
                <SvgText x={h.c[0]} y={h.c[1] - 16} fontSize="9" fill={ink.labelFill} textAnchor="middle">
                  {signNum}
                </SvgText>
                <PlanetStack planets={ps} cx={h.c[0]} cy={h.c[1] + 4} inkColor={ink.planetFill} />
              </G>
            );
          })}
        </Svg>
      </View>
    );
  }

  // South-Indian
  const bySign = {};
  grahas.forEach((p) => { const sg = signOf(p.sid); (bySign[sg] = bySign[sg] || []).push(p); });
  const ascS = SIGNS[ascSign];

  return (
    <View style={{ alignItems: "center" }}>
      <Svg viewBox="0 0 400 400" width="100%" height={330} style={{ maxWidth: 330 }}>
        {Object.entries(SOUTH).map(([sign, [col, row]]) => {
          const x = col * 100;
          const y = row * 100;
          const ps = bySign[sign] || [];
          const isAsc = sign === ascS;
          return (
            <G key={sign}>
              <Rect
                x={x} y={y} width="100" height="100"
                fill={isAsc ? ink.ascFill : "none"}
                stroke={ink.stroke}
                strokeWidth="1.3"
              />
              <SvgText x={x + 6} y={y + 15} fontSize="9" fill={ink.labelFill}>
                {sign.slice(0, 3)}
              </SvgText>
              <PlanetStack planets={ps} cx={x + 50} cy={y + 52} inkColor={ink.planetFill} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
