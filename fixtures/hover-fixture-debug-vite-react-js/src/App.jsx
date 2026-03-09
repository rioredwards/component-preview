import React from "react";
import { Header } from "./header.jsx";
import { Marquee } from "./marquee.jsx";
import { StripeBox } from "./StripeBox.jsx";

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <Header />

      <Marquee />

      <main id="main">
        <div className="container">
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
                    A single-file demo page for showcasing UI components. It is intentionally a
                    little playful: thick outlines, warm gradients, sticker headlines, and icon
                    placeholders you can swap with your own SVGs.
                  </p>

                  <div className="tag-row">
                    <span className="tag">
                      <span className="spark" aria-hidden="true" />
                      design tokens in :root
                    </span>
                    <span className="tag">
                      <span
                        className="spark"
                        aria-hidden="true"
                        style={{ background: "var(--sky)" }}
                      />
                      no images of people
                    </span>
                    <span className="tag">
                      <span
                        className="spark"
                        aria-hidden="true"
                        style={{ background: "var(--pink)" }}
                      />
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
                      Dark action
                    </span>
                  </div>
                </div>

                <StripeBox />
              </div>
            </div>
          </section>

          <section id="components">
            <div className="section-head">
              <h2 className="section-title">Component showcase</h2>
              <div className="section-note">10-ish pieces, zero JavaScript</div>
            </div>

            <div className="grid">
              <div className="card col-6">
                <div className="card-pad">
                  <h3>Icon placeholders</h3>
                  <p className="small">
                    These are tiny inline SVGs (tree, flower, star). Swap with your own icons
                    easily.
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
                        Keep your theme in <span style={{ fontFamily: "var(--mono)" }}>:root</span>,
                        then your extension can hot-swap classnames without chasing hard-coded
                        colors.
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

          <div className="hr" />

          <section id="forms">
            <div className="section-head">
              <h2 className="section-title">Form components</h2>
              <div className="section-note">inputs, selects, textarea</div>
            </div>

            <div className="grid">
              <div className="card col-8">
                <div className="card-pad">
                  <h3>Newsletter box</h3>
                  <p className="small">All static, but styled like a real landing page.</p>

                  <div className="field-row" style={{ marginTop: 12 }}>
                    <div>
                      <label htmlFor="firstName">First name</label>
                      <input id="firstName" name="firstName" placeholder="River" />
                    </div>
                    <div>
                      <label htmlFor="email">Email</label>
                      <input id="email" name="email" placeholder="river@example.com" />
                    </div>
                  </div>

                  <div className="field-row" style={{ marginTop: 12 }}>
                    <div>
                      <label htmlFor="topic">Topic</label>
                      <select id="topic" name="topic" defaultValue="Design tokens">
                        <option>Design tokens</option>
                        <option>Component previews</option>
                        <option>CSS-only layouts</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="priority">Priority</label>
                      <select id="priority" name="priority" defaultValue="Normal">
                        <option>Low</option>
                        <option>Normal</option>
                        <option>High</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="note">Note</label>
                    <textarea id="note" name="note" placeholder="Drop a short message here..." />
                  </div>

                  <div className="form-actions">
                    <span className="btn btn--primary">
                      <span className="dot" aria-hidden="true" />
                      Get updates
                    </span>
                    <span className="btn">
                      <span className="dot" aria-hidden="true" />
                      Reset (visual only)
                    </span>
                  </div>
                </div>
              </div>

              <div className="card col-4">
                <div className="card-pad">
                  <h3>Color chips</h3>
                  <p className="small">Quick palette references for your demo.</p>

                  <div className="grid" style={{ marginTop: 12 }}>
                    <div className="col-6">
                      <div
                        className="sticker"
                        style={{ width: "100%", textAlign: "center", background: "var(--pink)" }}>
                        --pink
                      </div>
                    </div>
                    <div className="col-6">
                      <div
                        className="sticker"
                        style={{ width: "100%", textAlign: "center", background: "var(--orange)" }}>
                        --orange
                      </div>
                    </div>
                    <div className="col-6">
                      <div
                        className="sticker"
                        style={{ width: "100%", textAlign: "center", background: "var(--butter)" }}>
                        --butter
                      </div>
                    </div>
                    <div className="col-6">
                      <div
                        className="sticker"
                        style={{ width: "100%", textAlign: "center", background: "var(--mint)" }}>
                        --mint
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 12 }} />

                  <div className="alert">
                    <div
                      className="alert-badge"
                      aria-hidden="true"
                      style={{ background: "var(--butter)" }}>
                      i
                    </div>
                    <div className="small">
                      Everything is themeable via{" "}
                      <span style={{ fontFamily: "var(--mono)" }}>:root</span> custom properties.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="hr" />

          <section id="pricing">
            <div className="section-head">
              <h2 className="section-title">Pricing cards</h2>
              <div className="section-note">just for variety</div>
            </div>

            <div className="grid">
              <div className="card col-4">
                <div className="card-pad">
                  <div className="price-top">
                    <div className="sticker" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      starter
                    </div>
                    <div className="sticker sticker--butter" style={{ fontSize: 12 }}>
                      popular
                    </div>
                  </div>
                  <div className="price">$9</div>
                  <ul className="list">
                    <li>
                      <span className="check" aria-hidden="true" />
                      Basic layout kit
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      Button styles
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      Form controls
                    </li>
                  </ul>
                  <div style={{ height: 12 }} />
                  <span className="btn btn--secondary" style={{ width: "100%" }}>
                    <span className="dot" aria-hidden="true" />
                    Select
                  </span>
                </div>
              </div>

              <div className="card col-4" style={{ background: "rgba(255, 134, 179, 0.18)" }}>
                <div className="card-pad">
                  <div className="price-top">
                    <div className="sticker" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      pro
                    </div>
                    <div className="sticker sticker--pink" style={{ fontSize: 12 }}>
                      new
                    </div>
                  </div>
                  <div className="price">$29</div>
                  <ul className="list">
                    <li>
                      <span className="check" aria-hidden="true" />
                      Sticker headings
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      Marquee bar
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      Icon placeholders
                    </li>
                  </ul>
                  <div style={{ height: 12 }} />
                  <span className="btn btn--primary" style={{ width: "100%" }}>
                    <span className="dot" aria-hidden="true" />
                    Select
                  </span>
                </div>
              </div>

              <div className="card col-4" style={{ background: "rgba(255, 122, 47, 0.14)" }}>
                <div className="card-pad">
                  <div className="price-top">
                    <div className="sticker" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      max
                    </div>
                    <div className="sticker sticker--orange" style={{ fontSize: 12 }}>
                      extra
                    </div>
                  </div>
                  <div className="price">$59</div>
                  <ul className="list">
                    <li>
                      <span className="check" aria-hidden="true" />
                      More variants
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      More sections
                    </li>
                    <li>
                      <span className="check" aria-hidden="true" />
                      More vibes
                    </li>
                  </ul>
                  <div style={{ height: 12 }} />
                  <span className="btn" style={{ width: "100%" }}>
                    <span className="dot" aria-hidden="true" />
                    Select
                  </span>
                </div>
              </div>
            </div>
          </section>

          <footer>
            <div className="footer-card">
              <div>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>
                  Done. Add your own components below.
                </div>
                <div className="muted-mono" style={{ marginTop: 6 }}>
                  Tip: keep this as a single HTML file for your extension demo, and let the
                  extension swap classnames.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="sticker" style={{ fontFamily: "var(--mono)" }}>
                  v1.0
                </span>
                <span className="btn btn--dark">
                  <span className="dot" aria-hidden="true" />
                  Export
                </span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
