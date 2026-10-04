import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./site.css";

export default function SiteLayout({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    setOpen(false);
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="masthead">
        <div className="wrap">
          <Link className="wordmark" to="/">
            Smart Team Contribution Monitoring
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>

          <nav id="site-nav" className={`nav${open ? " open" : ""}`} aria-label="Primary">
            <a href="/#how">How it works</a>
            <a href="/#estimator">Try the estimator</a>
            <a href="/#evidence">Model results</a>
            <Link className="btn small" to="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="footer">
        <div className="wrap footer-grid">
          <p>
            A course project that estimates contribution risk in student team work. Predictions are
            decision support for faculty and are not a grade.
          </p>
          <nav aria-label="Legal">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
