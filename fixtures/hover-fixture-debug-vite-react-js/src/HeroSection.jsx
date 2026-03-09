import React from "react";

export function HeroSection() {
  return (
    <section id="hero" className="hero">
      <div className="hero-wrap">
        <div className="hero-grid">
          <div>
            <div className="hero-kicker">
              <span className="smiley" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round">
                  <circle cx="8.5" cy="10" r="1.2" />
                  <circle cx="15.5" cy="10" r="1.2" />
                  <path d="M7.8 14.2c1.2 1.4 2.6 2.1 4.2 2.1s3-0.7 4.2-2.1" />
                </svg>
              </span>

              <span className="sticker sticker--butter">component preview playground</span>
              <span className="sticker">vanilla HTML + CSS</span>
            </div>

            <h1 className="outline-text">
              Sticky shapes,
              <br />
              bold borders,
              <br />
              good vibes.
            </h1>

            <p className="sub">
              A single-file demo page for showcasing UI components. It is intentionally a little
              playful: thick outlines, warm gradients, sticker headlines, and icon placeholders you
              can swap with your own SVGs.
            </p>

            <div className="tag-row">
              <span className="tag">
                <span className="spark" aria-hidden="true" />
                design tokens in :root
              </span>
              <span className="tag">
                <span className="spark" aria-hidden="true" style={{ background: "var(--sky)" }} />
                stuff to look at
              </span>
              <span className="tag">
                <span className="spark" aria-hidden="true" style={{ background: "var(--pink)" }} />
                copy-paste friendly
              </span>
            </div>

            <div className="cta-row">
              <span className="btn btn--secondary">
                <span className="dot" aria-hidden="true" />
                Primary action
              </span>
              <span className="btn">
                <span className="dot" aria-hidden="true" />
                Secondary action
              </span>
              <span className="btn btn--dark">
                <span className="dot" aria-hidden="true" />
                Evil action
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
