import React from "react";
import LegalPage, { Draft } from "./LegalPage.jsx";

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-10-04">
      <section>
        <h2>Who runs this service</h2>
        <p>
          <Draft>operator name, institution and contact address for privacy requests.</Draft>
        </p>
      </section>

      <section>
        <h2>What the service stores</h2>
        <ul>
          <li>
            Account details: name, email address, register number, role (student or faculty), team
            membership, and a hashed password. The password itself is never stored.
          </li>
          <li>Tasks: title, assigned student, status, deadline and completion time.</li>
          <li>
            Activity: for each student and day, counts of document edits, commits, messages sent,
            replies given, and active minutes.
          </li>
          <li>
            Predictions: the contribution score, risk level, the decision (allow, nudge or alert),
            the written reasons, and the numeric inputs used to calculate them.
          </li>
          <li>
            Faculty feedback: whether a prediction was marked correct or incorrect, an optional
            comment, the reviewer and the time.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who can see it</h2>
        <p>
          A student can see their own tasks, activity, score and written reasons. Faculty can see
          the scores, reasons and history for students in the teams assigned to them.
        </p>
      </section>

      <section>
        <h2>Why it is processed</h2>
        <p>
          Activity and task data are used to estimate whether a student is contributing to a team
          project, so that faculty can step in early. A neural network service calculates part of
          the estimate. That service runs alongside the application and receives only the numeric
          inputs, not names or email addresses.
        </p>
        <p>
          <Draft>legal basis or institutional authority for processing student data.</Draft>
        </p>
      </section>

      <section>
        <h2>The public estimator</h2>
        <p>
          The estimator on the home page sends the numbers you type to the neural network service
          and shows the result. Those numbers are not stored and are not linked to an account.
        </p>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          The application sets no cookies. After you sign in, it keeps a sign-in token and your name,
          role and team in the browser's local storage so you stay signed in. Signing out removes
          them. The site includes no analytics or advertising trackers.
        </p>
      </section>

      <section>
        <h2>Demo mode</h2>
        <p>
          In the built-in demo, data is held in memory with generated example students and is erased
          when the server stops. With a configured database, data is kept until it is deleted.
        </p>
      </section>

      <section>
        <h2>Retention, deletion and your rights</h2>
        <p>
          <Draft>how long data is kept, how a person can request access, correction or deletion,
          and who handles those requests.</Draft>
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Passwords are hashed and sign-in tokens expire after 8 hours. Access to team data is
          limited by role. <Draft>hosting location, encryption in transit and backup practices.</Draft>
        </p>
      </section>

      <section>
        <h2>Minors and sharing with third parties</h2>
        <p>
          <Draft>age of the intended users and any disclosure of data outside the institution.</Draft>
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          <Draft>how users will be told about changes.</Draft>
        </p>
      </section>
    </LegalPage>
  );
}
