import { SIGNS, signOf, nm } from "@/shared/astrology";

const PABBR = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

const NORTH = [
  { c: [200, 108] },
  { c: [100, 42] },
  { c: [42, 100] },
  { c: [100, 208] },
  { c: [42, 300] },
  { c: [100, 360] },
  { c: [200, 308] },
  { c: [200, 360] },
  { c: [358, 300] },
  { c: [300, 208] },
  { c: [358, 100] },
  { c: [300, 42] },
];

const SOUTH = {
  Pisces: [0, 0],
  Aries: [1, 0],
  Taurus: [2, 0],
  Gemini: [3, 0],
  Aquarius: [0, 1],
  Cancer: [3, 1],
  Capricorn: [0, 2],
  Leo: [3, 2],
  Sagittarius: [0, 3],
  Scorpio: [1, 3],
  Libra: [2, 3],
  Virgo: [3, 3],
};

export default function KundaliChart({ chart, variant }) {
  const grahas = chart.planets.filter((p) => PABBR[p.base]);
  const ascSign = Math.floor(nm(chart.angles.ascSid) / 30);
  const stk = (arr, cx, cy) =>
    arr.map((p, j) => (
      <text
        key={j}
        x={cx}
        y={cy + j * 13 - (arr.length - 1) * 6.5}
        fontSize="11.5"
        fill={p.retro ? "#fca5a5" : "#fff"}
        textAnchor="middle"
      >
        {PABBR[p.base]}
      </text>
    ));

  if (variant === "north") {
    const byHouse = {};
    grahas.forEach((p) => {
      (byHouse[p.houseSid] = byHouse[p.houseSid] || []).push(p);
    });
    return (
      <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 330, display: "block", margin: "0 auto" }}>
        <rect
          x="1"
          y="1"
          width="398"
          height="398"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
        />
        <line x1="0" y1="0" x2="400" y2="400" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
        <line x1="400" y1="0" x2="0" y2="400" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
        <polygon
          points="200,0 400,200 200,400 0,200"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1.5"
        />
        {NORTH.map((h, i) => {
          const signNum = ((ascSign + i) % 12) + 1;
          const ps = byHouse[i + 1] || [];
          return (
            <g key={i}>
              <text x={h.c[0]} y={h.c[1] - 16} fontSize="9" fill="rgba(255,255,255,0.3)" textAnchor="middle">
                {signNum}
              </text>
              {stk(ps, h.c[0], h.c[1] + 4)}
            </g>
          );
        })}
      </svg>
    );
  }

  const bySign = {};
  grahas.forEach((p) => {
    const s = signOf(p.sid);
    (bySign[s] = bySign[s] || []).push(p);
  });
  const ascS = SIGNS[ascSign];
  return (
    <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 330, display: "block", margin: "0 auto" }}>
      {Object.entries(SOUTH).map(([sign, [col, row]]) => {
        const x = col * 100,
          y = row * 100,
          ps = bySign[sign] || [],
          isAsc = sign === ascS;
        return (
          <g key={sign}>
            <rect
              x={x}
              y={y}
              width="100"
              height="100"
              fill={isAsc ? "rgba(99, 102, 241, 0.1)" : "none"}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.3"
            />
            <text x={x + 6} y={y + 15} fontSize="9" fill="rgba(255,255,255,0.3)">
              {sign.slice(0, 3)}
            </text>
            {stk(ps, x + 50, y + 52)}
          </g>
        );
      })}
    </svg>
  );
}
