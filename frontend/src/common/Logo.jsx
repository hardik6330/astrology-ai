import logoUrl from "@/assets/homescreen-logo.png";

// Brand mark — the Selora logo (galaxy swirl + spark), rendered as an <img> from
// the shared 500×500 PNG (the same asset as the mobile home-screen icon) so the
// web and app brand read identically. Keeps the {size, className} API of the old
// inline-SVG mark, so every caller (login header, landing nav/footer) is
// unchanged. Pairs with the "Selora" wordmark, which callers render in the
// display font — so the image is decorative (aria-hidden / empty alt).
export default function Logo({ size = 22, className = "" }) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
      style={{ objectFit: "contain", display: "inline-block" }}
    />
  );
}
