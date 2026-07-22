// Transparent-background solar-system loader: nine planets orbiting a glowing
// sun. Each planet's lap time is derived from its REAL orbital period (Earth
// days) with a sqrt compression — dur = BASE * sqrt(period / Mercury). That
// keeps the true ordering and the inner-fast / outer-slow feel, but squeezes
// the real ~1029:1 Mercury:Pluto ratio enough that every planet visibly drifts
// during a load (true ratios would leave the outer planets frozen).
//
// Geometry: each planet has a centered "orbit layer" box of side 2·r that spins
// via @keyframes orbit-spin (index.css); the planet sits at the top-center of
// that box, so rotating the box carries it around a circle of radius r. A
// negative animation-delay (phase) staggers the start angles so they're not all
// lined up at 12 o'clock.

import {
  SOLAR_PLANETS as PLANETS,
  SOLAR_MERCURY_PERIOD as MERCURY,
} from "../../../packages/astrology-core/src/index.js";

const BASE = 4; // seconds for Mercury's lap (the fastest)

const durOf = (period) => BASE * Math.sqrt(period / MERCURY);

export default function SolarSystemLoader({ label = "Aligning all nine planets…", size = 330 }) {
  const scale = size / 330; // all geometry is authored at 330px, then scaled

  return (
    <div style={{ display: "grid", placeItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        {/* Sun */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 26 * scale,
            height: 26 * scale,
            marginLeft: -13 * scale,
            marginTop: -13 * scale,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #fff3b0, #ffb627 45%, #ff7a00 82%)",
            boxShadow: `0 0 ${18 * scale}px ${6 * scale}px rgba(255,170,0,0.45)`,
          }}
        />

        {PLANETS.map((p) => {
          const r = p.r * scale;
          const ps = p.size * scale;
          const box = 2 * r;
          const dur = durOf(p.period);
          return (
            <div key={p.name}>
              {/* Orbit ring */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: box,
                  height: box,
                  marginLeft: -r,
                  marginTop: -r,
                  borderRadius: "50%",
                  border: "1px solid rgba(150,150,200,0.16)",
                }}
              />
              {/* Rotating layer carrying the planet */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: box,
                  height: box,
                  marginLeft: -r,
                  marginTop: -r,
                  animation: `orbit-spin ${dur}s linear infinite`,
                  animationDelay: `-${(p.phase * dur).toFixed(2)}s`,
                }}
              >
                {/* Saturn's ring (sits behind the body, drawn first) */}
                {p.ring && (
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      transform: "translate(-50%, -50%) rotate(-20deg)",
                      width: ps * 2.4,
                      height: ps * 0.9,
                      borderRadius: "50%",
                      border: `${Math.max(1, ps * 0.16)}px solid rgba(227,198,148,0.55)`,
                    }}
                  />
                )}
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    transform: "translate(-50%, -50%)",
                    width: ps,
                    height: ps,
                    borderRadius: "50%",
                    background: p.color,
                    boxShadow: `0 0 ${Math.max(3, ps)}px ${p.color}66`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {label && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "#a5b4fc",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
