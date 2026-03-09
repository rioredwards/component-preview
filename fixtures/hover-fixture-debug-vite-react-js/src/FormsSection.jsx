import React from "react";

export function FormsSection() {
  return (
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
  );
}

