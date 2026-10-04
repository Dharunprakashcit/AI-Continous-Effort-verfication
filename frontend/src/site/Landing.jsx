import React from "react";
import { Link } from "react-router-dom";
import SiteLayout from "./SiteLayout.jsx";
import RiskEstimator from "./RiskEstimator.jsx";
import ModelResults from "./ModelResults.jsx";

const SAMPLE_ROWS = [
  { name: "Student A", score: 91, level: "Low" },
  { name: "Student B", score: 74, level: "Low" },
  { name: "Student C", score: 46, level: "Medium", open: true },
  { name: "Student D", score: 19, level: "High" },
];

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div>
          <h1 id="hero-title">See who is contributing while there is still time to help.</h1>
          <p className="lede">
            Faculty get a contribution score for every student in a team project, with the reasons
            behind it. Students see the same score and know where they stand before the deadline.
          </p>
          <div className="actions">
            <Link className="btn" to="/login">
              Open the demo
            </Link>
            <a className="btn secondary" href="#estimator">
              Try the estimator
            </a>
          </div>
        </div>

        <figure className="sample" style={{ margin: 0 }}>
          <div className="sample-head">
            <strong>Team Alpha</strong>
            <span>Faculty view</span>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Contribution</th>
                <th scope="col">Risk</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((r) => (
                <tr key={r.name} className={r.open ? "is-open" : undefined}>
                  <td>{r.name}</td>
                  <td>{r.score}%</td>
                  <td>
                    <span className={`risk ${r.level.toLowerCase()}`}>{r.level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="why">
            <p>
              <strong>Student C</strong>, reasons shown to faculty:
            </p>
            <p>Two of four tasks are late. Few document edits in the last 7 days. Low discussion activity.</p>
            <p>Suggested action: send a reminder to the student.</p>
          </div>
          <figcaption className="sample-note">Sample data, shown for illustration.</figcaption>
        </figure>
      </div>
    </section>
  );
}

const SIGNALS = [
  ["Task completion", "The share of assigned tasks that are finished, and whether they were finished before the deadline."],
  ["Document edits", "Edits to shared documents. Counts level off as they grow, so one burst of editing does not outweigh steady work."],
  ["Commits", "Code commits in the last 7 days."],
  ["Discussion", "Messages sent and replies given to teammates. Replies count for more, because answering a teammate is a stronger sign of teamwork than posting."],
  ["Active days", "How many of the last 7 days the student did anything at all."],
];

const STEPS = [
  ["Collect", "Tasks, edits, commits and messages from the last 7 days are gathered for each student."],
  ["Score", "Separate scorers for edits, tasks and communication each produce a score from 0 to 100 and a written note."],
  ["Estimate", "A neural network trained on activity patterns estimates the probability that the student is free riding."],
  ["Decide", "The scores and the estimate combine into one risk figure. Below 30 the system only monitors. From 30 to 70 it nudges the student. Above 70 it alerts faculty."],
];

function Signals() {
  return (
    <section id="how" className="section" aria-labelledby="signals-title">
      <div className="wrap split">
        <div>
          <h2 id="signals-title">Five signals, one score you can explain.</h2>
          <p className="lede" style={{ marginTop: "var(--s4)" }}>
            Every score arrives with the reasons behind it, in plain sentences, so a faculty member
            can act on evidence instead of a hunch.
          </p>
        </div>
        <dl className="signals">
          {SIGNALS.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Pipeline() {
  return (
    <section className="section band" aria-labelledby="pipeline-title">
      <div className="wrap">
        <h2 id="pipeline-title">From activity to a decision.</h2>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="step-num" aria-hidden="true">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <p className="after-steps">
          Faculty can mark any prediction correct or incorrect. That feedback is saved and can be
          used to retrain the model.
        </p>
      </div>
    </section>
  );
}

function Estimator() {
  return (
    <section id="estimator" className="section" aria-labelledby="estimator-title">
      <div className="wrap">
        <h2 id="estimator-title">Try the network on one week of activity.</h2>
        <p className="lede" style={{ margin: "var(--s4) 0 var(--s5)" }}>
          Enter a student's totals for the last 7 days. The estimate comes from the trained network
          running in this project.
        </p>
        <RiskEstimator />
      </div>
    </section>
  );
}

function Evidence() {
  return (
    <section id="evidence" className="section band" aria-labelledby="evidence-title">
      <div className="wrap">
        <h2 id="evidence-title">How well does it predict?</h2>
        <p className="lede" style={{ margin: "var(--s4) 0 var(--s5)" }}>
          These figures come from a simulated dataset, because no public data exists for team free
          riding. They describe how the method performs on synthetic data, not on real classrooms.
        </p>
        <ModelResults />
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section className="section" aria-labelledby="who-title">
      <div className="wrap two-col">
        <div>
          <h2 id="who-title">For faculty</h2>
          <p style={{ marginTop: "var(--s3)" }}>
            One table per team lists every student's contribution, risk level and recommended action.
            Open a student to see the score from each scorer, the written reasons and the history of
            earlier evaluations. Re-run an evaluation at any time, and mark predictions correct or
            incorrect.
          </p>
        </div>
        <div>
          <h2>For students</h2>
          <p style={{ marginTop: "var(--s3)" }}>
            Students see their own contribution score, tasks, last 7 days of activity and the same
            written feedback faculty see. Logging activity or finishing a task re-runs the evaluation,
            so the score reflects work as it happens.
          </p>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="section band" aria-labelledby="closing-title">
      <div className="wrap closing">
        <div>
          <h2 id="closing-title">Open the demo.</h2>
          <p className="lede" style={{ marginTop: "var(--s3)" }}>
            Sign in as faculty with faculty@example.edu, or as a student with an address from
            23cs001@example.edu through 23cs004@example.edu. The password for every demo account is
            password123.
          </p>
        </div>
        <Link className="btn" to="/login">
          Sign in to the demo
        </Link>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <SiteLayout>
      <Hero />
      <Signals />
      <Pipeline />
      <Estimator />
      <Evidence />
      <Audiences />
      <Closing />
    </SiteLayout>
  );
}
