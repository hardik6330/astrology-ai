// Canonical card surface for the whole app. Wraps the shared `.cosmic-card`
// styling (defined in index.css — glass blur, border, slideUp animation,
// responsive padding) so every card looks and animates the same and there's
// one place to evolve it.
//
// Usage:
//   <Card>…</Card>
//   <Card style={{ textAlign: "center" }}>…</Card>
//   <Card as="form" onSubmit={fn}>…</Card>
//   <Card className="big-three-card">…</Card>   // compose extra classes
//
// Any extra className is appended; style + event handlers + refs pass through.

import { forwardRef } from "react";

const Card = forwardRef(function Card({ as: Tag = "div", className = "", style, children, ...rest }, ref) {
  const cls = className ? `cosmic-card ${className}` : "cosmic-card";
  return (
    <Tag ref={ref} className={cls} style={style} {...rest}>
      {children}
    </Tag>
  );
});

export default Card;
