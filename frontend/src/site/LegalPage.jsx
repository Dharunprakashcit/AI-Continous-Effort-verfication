import React from "react";
import SiteLayout from "./SiteLayout.jsx";

export function Draft({ children }) {
  return <span className="draft-mark">Draft: {children}</span>;
}

export default function LegalPage({ title, updated, children }) {
  return (
    <SiteLayout>
      <article className="legal wrap">
        <h1>{title}</h1>
        <p className="draft-banner" role="note">
          This page is a draft for review. It describes how the software works today. Items marked
          Draft are undecided and must be completed by the operator before public use.
        </p>
        <p className="muted">Last edited: {updated}</p>
        {children}
      </article>
    </SiteLayout>
  );
}
