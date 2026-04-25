export function Header() {
  return (
    <header>
      <div className="container">
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true" />
            <span>PLAYGROUND</span>
          </a>

          <div className="nav-links" role="navigation">
            <a href="#hero">Hero</a>
            <a href="#components">Components</a>
            <a href="#forms">Forms</a>
            <a href="#pricing">Pricing</a>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="sticker" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              no JS
            </span>
            <span className="btn btn--primary">
              <span className="dot" aria-hidden="true" />
              Preview
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}
