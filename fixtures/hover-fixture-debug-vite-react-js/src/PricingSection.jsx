import React from "react";
import { PricingCard } from "./PricingCard";

export function PricingSection() {
  return (
    <section id="pricing">
      <div className="section-head">
        <h2 className="section-title">Pricing cards</h2>
      </div>

      <div className="grid">
        <PricingCard
          planLabel="starter"
          statusLabel="popular"
          statusStickerClassName="sticker sticker--butter"
          price="$9"
          features={["Basic layout kit", "Button styles", "Form controls"]}
          buttonClassName="btn btn--secondary"
        />

        <PricingCard
          planLabel="pro"
          statusLabel="new"
          statusStickerClassName="sticker sticker--pink"
          price="$29"
          features={["Sticker headings", "Marquee bar", "Icon placeholders"]}
          backgroundStyle={{ background: "rgba(255, 134, 179, 0.18)" }}
          buttonClassName="btn btn--primary"
        />

        <PricingCard
          planLabel="max"
          statusLabel="extra"
          statusStickerClassName="sticker sticker--orange"
          price="$59"
          features={["More variants", "More sections", "More vibes"]}
          backgroundStyle={{ background: "rgba(255, 122, 47, 0.14)" }}
          buttonClassName="btn"
        />
      </div>
    </section>
  );
}
