import React from "react";

export function StripeBox() {
  return (
    <aside className="stripe-box" aria-label="Palette stripes">
      <div className="stripes">
        <div className="stripe" />
        <div className="stripe" />
        <div className="stripe" />
        <div className="stripe" />
        <div className="stripe" />
        <div className="stripe" />
      </div>
      <div className="stripe-label">drop in your own icons here</div>
    </aside>
  );
}
