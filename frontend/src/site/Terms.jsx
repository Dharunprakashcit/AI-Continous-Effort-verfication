import React from "react";
import LegalPage, { Draft } from "./LegalPage.jsx";

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="2026-10-04">
      <section>
        <h2>What this service is</h2>
        <p>
          Smart Team Contribution Monitoring is software that tracks task completion, document and
          code activity, and discussion in student team projects, and estimates a contribution score
          and risk level for each student. It is a course project and a working prototype.
        </p>
        <p>
          <Draft>operator name, institution, and whether the service is offered beyond the course.</Draft>
        </p>
      </section>

      <section>
        <h2>Accounts</h2>
        <p>
          Accounts are issued as student or faculty accounts and are tied to a team. You are
          responsible for keeping your password private and for activity under your account.
          Demo accounts exist for evaluation and share a known password, so do not enter real
          personal information into them.
        </p>
      </section>

      <section>
        <h2>How predictions should be used</h2>
        <p>
          Scores, risk levels and recommendations are estimates produced by a neural network and
          rule based agents. The network was trained on a simulated dataset. They are decision
          support for faculty and are not a grade, a finding of misconduct, or evidence on their
          own. Faculty can mark any prediction correct or incorrect, and that feedback is stored.
        </p>
        <p>
          <Draft>the institution's policy on using these results in assessment or academic
          integrity proceedings.</Draft>
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not attempt to access another team's data, inflate activity counts to mislead the
          system, or interfere with the service. <Draft>full acceptable use rules and the
          consequences of breaking them.</Draft>
        </p>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          How data is collected and used is described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Availability, warranty and liability</h2>
        <p>
          <Draft>availability commitments, warranty disclaimer and limits of liability, to be
          written or approved by the operator.</Draft>
        </p>
      </section>

      <section>
        <h2>Ending access and changes</h2>
        <p>
          <Draft>how accounts are suspended or closed, and how changes to these terms are
          communicated.</Draft>
        </p>
      </section>

      <section>
        <h2>Governing law and contact</h2>
        <p>
          <Draft>governing law, dispute process and a contact address.</Draft>
        </p>
      </section>
    </LegalPage>
  );
}
