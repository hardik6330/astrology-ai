// The calm in-app cosmic backdrop: a fixed nebula gradient (.cosmos) + a faint
// drifting starfield (.stars), with an occasional shooting star. Same color
// palette as the landing/login .fx backdrop, dialed way down so it sits quietly
// behind content-dense screens (reading, chat, etc.) without hurting readability.
//
// Single source of this markup. In-app routes get it automatically via the
// CalmShell wrapper in routes.jsx — page files should NOT render it themselves.
// (The CSS lives in src/index.css.)
export default function CosmicBackground({ shootingStar = false }) {
  return (
    <>
      <div className="cosmos" />
      <div className="stars" />
      {shootingStar && <div className="shooting-star" />}
    </>
  );
}
