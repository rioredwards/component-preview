import React from "react";

export function Footer() {
  return (
    <footer>
      <div className="footer-card">
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Done. Add your own components below.
          </div>
          <div className="muted-mono" style={{ marginTop: 6 }}>
            Tip: keep this as a single HTML file for your extension demo, and let the extension swap
            classnames.
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
  );
}

