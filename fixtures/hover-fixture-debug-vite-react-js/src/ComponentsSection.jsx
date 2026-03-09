import React from "react";

export function ComponentsSection() {
  return (
    <section id="components">
      <div className="section-head">
        <h2 className="section-title">Component showcase</h2>
      </div>

      <div className="grid">
        <div className="card col-6">
          <div className="card-pad">
            <h3>Icon placeholders</h3>
            <p className="small">
              These are tiny inline SVGs (tree, flower, star). Swap with your own icons easily.
            </p>

            <div className="icon-row">
              <span className="icon-pill">
                <span className="glyph" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M12 3c-3 2-4.5 4.6-4.5 7.6 0 2.7 1.2 4.4 2.3 5.6 0.8 0.9 1.2 1.8 1.2 3.2V21" />
                    <path d="M12 3c3 2 4.5 4.6 4.5 7.6 0 2.7-1.2 4.4-2.3 5.6-0.8 0.9-1.2 1.8-1.2 3.2V21" />
                    <path d="M8 21h8" />
                  </svg>
                </span>
                Tree icon
              </span>

              <span className="icon-pill">
                <span
                  className="glyph"
                  aria-hidden="true"
                  style={{
                    background: "linear-gradient(135deg, var(--pink), var(--butter))",
                  }}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M12 21s-5-3.2-5-8a3.2 3.2 0 0 1 5-2.7A3.2 3.2 0 0 1 17 13c0 4.8-5 8-5 8z" />
                    <path d="M12 9V3" />
                  </svg>
                </span>
                Flower icon
              </span>

              <span className="icon-pill">
                <span
                  className="glyph"
                  aria-hidden="true"
                  style={{ background: "linear-gradient(135deg, var(--sky), var(--mint))" }}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M12 2l2.9 6.1 6.7.8-5 4.4 1.5 6.6L12 16.9 5.9 20l1.5-6.6-5-4.4 6.7-.8L12 2z" />
                  </svg>
                </span>
                Star icon
              </span>
            </div>
          </div>
        </div>

        <div className="card col-6">
          <div className="card-pad">
            <h3>Tabs + alert</h3>
            <p className="small">Static tabs (no JS), plus a friendly alert block.</p>

            <div className="tabs" role="tablist" aria-label="Demo tabs">
              <span className="tab is-active" role="tab" aria-selected="true">
                Overview
              </span>
              <span className="tab" role="tab" aria-selected="false">
                Tokens
              </span>
              <span className="tab" role="tab" aria-selected="false">
                Layout
              </span>
            </div>

            <div style={{ height: 12 }} />

            <div className="alert" role="note" aria-label="Demo alert">
              <div className="alert-badge" aria-hidden="true">
                !
              </div>
              <div>
                <div style={{ fontWeight: 1000 }}>Tip</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Keep your theme in <span style={{ fontFamily: "var(--mono)" }}>:root</span>, then
                  your extension can hot-swap classnames without chasing hard-coded colors.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card col-4">
          <div className="card-pad">
            <h3>Feature list</h3>
            <ul className="list" style={{ marginTop: 10 }}>
              <li>
                <span className="check" aria-hidden="true" />
                Thick borders
              </li>
              <li>
                <span className="check" aria-hidden="true" />
                Sticker chips
              </li>
              <li>
                <span className="check" aria-hidden="true" />
                Warm gradients
              </li>
              <li>
                <span className="check" aria-hidden="true" />
                Big rounded corners
              </li>
              <li>
                <span className="check" aria-hidden="true" />
                CSS-only motion
              </li>
            </ul>
          </div>
        </div>

        <div className="card col-8">
          <div className="card-pad">
            <h3>Status tiles</h3>
            <p className="small">Useful for showing variants your extension previews.</p>

            <div className="grid" style={{ marginTop: 12 }}>
              <div className="card col-4" style={{ background: "var(--card-2)" }}>
                <div className="card-pad">
                  <div
                    className="sticker sticker--butter"
                    style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                    variant A
                  </div>
                  <div className="price" style={{ marginTop: 10 }}>
                    Classic
                  </div>
                  <div className="small">Higher contrast, tighter spacing.</div>
                </div>
              </div>

              <div className="card col-4" style={{ background: "rgba(255, 134, 179, 0.25)" }}>
                <div className="card-pad">
                  <div
                    className="sticker sticker--pink"
                    style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                    variant B
                  </div>
                  <div className="price" style={{ marginTop: 10 }}>
                    Bouncy
                  </div>
                  <div className="small">More stickers, more shadows.</div>
                </div>
              </div>

              <div className="card col-4" style={{ background: "rgba(255, 122, 47, 0.18)" }}>
                <div className="card-pad">
                  <div
                    className="sticker sticker--orange"
                    style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                    variant C
                  </div>
                  <div className="price" style={{ marginTop: 10 }}>
                    Sunny
                  </div>
                  <div className="small">Warmer palette emphasis.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
