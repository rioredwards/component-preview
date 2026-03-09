import React from "react";

export function PricingCard({
  planLabel,
  statusLabel,
  statusStickerClassName,
  price,
  features,
  backgroundStyle,
  buttonClassName,
}) {
  return (
    <div className="card col-4" style={backgroundStyle}>
      <div className="card-pad">
        <div className="price-top">
          <div className="sticker" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
            {planLabel}
          </div>
          <div className={statusStickerClassName} style={{ fontSize: 12 }}>
            {statusLabel}
          </div>
        </div>
        <div className="price">{price}</div>
        <ul className="list">
          {features.map((feature) => (
            <li key={feature}>
              <span className="check" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
        <div style={{ height: 12 }} />
        <span className={buttonClassName} style={{ width: "100%" }}>
          <span className="dot" aria-hidden="true" />
          Select
        </span>
      </div>
    </div>
  );
}

