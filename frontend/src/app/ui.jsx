import React from "react";

export function RiskPill({ level }) {
  const key = (level || "unknown").toLowerCase();
  return <span className={`rpill ${key}`}>{level === "UNKNOWN" || !level ? "Not evaluated" : key[0].toUpperCase() + key.slice(1)}</span>;
}

export function Avatar({ name, size = 96 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">
      {initials}
    </div>
  );
}

export function StatCard({ tone, icon, label, value, suffix, children }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-row">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{children ?? value}</strong>
      </div>
    </div>
  );
}

export function Panel({ title, dark, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className={`panel-head${dark ? " dark" : ""}`}>
          <h2>{title}</h2>
          {action}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Skeleton({ lines = 3 }) {
  return (
    <div aria-label="Loading" role="status">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function PageState({ loading, error }) {
  if (loading) {
    return (
      <div className="panel"><div className="panel-body"><Skeleton lines={4} /></div></div>
    );
  }
  if (error) {
    return (
      <div className="panel"><div className="panel-body"><p className="state-error">{error}</p></div></div>
    );
  }
  return null;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
