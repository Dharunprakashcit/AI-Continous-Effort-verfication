import React, { useState } from "react";

const FIELDS = [
  { key: "tasks_completed_pct", label: "Tasks completed (%)", hint: "0 to 100", min: 0, max: 100 },
  { key: "doc_edits", label: "Document edits", hint: "Total in 7 days", min: 0 },
  { key: "messages_sent", label: "Messages sent", hint: "Total in 7 days", min: 0 },
  { key: "commits", label: "Commits", hint: "Total in 7 days", min: 0 },
  { key: "deadline_adherence_pct", label: "Deadlines met on time (%)", hint: "0 to 100", min: 0, max: 100 },
  { key: "active_days_last7", label: "Active days", hint: "0 to 7", min: 0, max: 7 },
];

const PRESETS = {
  steady: {
    label: "Steady contributor",
    values: { tasks_completed_pct: 80, doc_edits: 20, messages_sent: 15, commits: 8, deadline_adherence_pct: 90, active_days_last7: 6 },
  },
  low: {
    label: "Low activity",
    values: { tasks_completed_pct: 10, doc_edits: 1, messages_sent: 0, commits: 0, deadline_adherence_pct: 20, active_days_last7: 1 },
  },
};

function band(p) {
  if (p < 0.3) return { name: "Low", cls: "low" };
  if (p <= 0.7) return { name: "Medium", cls: "medium" };
  return { name: "High", cls: "high" };
}

function toForm(values) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));
}

function validate(form) {
  const errors = {};
  for (const f of FIELDS) {
    const raw = form[f.key].trim();
    const n = Number(raw);
    if (raw === "" || Number.isNaN(n)) {
      errors[f.key] = "Enter a number.";
    } else if (n < f.min || (f.max !== undefined && n > f.max)) {
      errors[f.key] = f.max !== undefined ? `Enter a value from ${f.min} to ${f.max}.` : "Enter zero or more.";
    }
  }
  return errors;
}

export default function RiskEstimator() {
  const [form, setForm] = useState(toForm(PRESETS.steady.values));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle" });

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const body = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]));
      const res = await fetch("/ann/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, log: false }),
      });
      if (!res.ok) throw new Error(`Service returned ${res.status}`);
      const data = await res.json();
      setState({ status: "done", probability: data.risk_probability, version: data.model_version });
    } catch {
      setState({ status: "error" });
    }
  }

  function applyPreset(key) {
    setForm(toForm(PRESETS[key].values));
    setErrors({});
    setState({ status: "idle" });
  }

  return (
    <div className="estimator-grid">
      <form onSubmit={submit} noValidate>
        <div className="presets" role="group" aria-label="Fill with an example">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} type="button" className="btn secondary small" onClick={() => applyPreset(key)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="fields">
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="number"
                inputMode="decimal"
                step="any"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                aria-invalid={errors[f.key] ? "true" : undefined}
                aria-describedby={`${f.key}-help`}
              />
              <span id={`${f.key}-help`} className={errors[f.key] ? "help error" : "help"}>
                {errors[f.key] || f.hint}
              </span>
            </div>
          ))}
        </div>

        <button type="submit" className="btn" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Estimating" : "Estimate risk"}
        </button>
      </form>

      <div className="result" aria-live="polite">
        {state.status === "idle" && (
          <p className="muted">Enter a week of activity and choose Estimate risk to see the result.</p>
        )}

        {state.status === "loading" && (
          <div aria-label="Loading result">
            <div className="skeleton line short" />
            <div className="skeleton block" />
            <div className="skeleton line" />
          </div>
        )}

        {state.status === "error" && (
          <div>
            <p className="result-title">The estimator could not be reached.</p>
            <p className="muted">
              The prediction service is not responding. Start it with{" "}
              <code>python predict_service.py</code> in the ann-service folder, then try again.
            </p>
          </div>
        )}

        {state.status === "done" && (
          <div>
            <p className="eyebrow">Estimated risk of free riding</p>
            <p className="big">
              {Math.round(state.probability * 100)}%{" "}
              <span className={`risk ${band(state.probability).cls}`}>{band(state.probability).name}</span>
            </p>
            <div
              className="meter"
              role="img"
              aria-label={`Risk ${Math.round(state.probability * 100)} percent`}
            >
              <div
                className={`meter-fill ${band(state.probability).cls}`}
                style={{ width: `${Math.round(state.probability * 100)}%` }}
              />
              <span className="tick" style={{ left: "30%" }} />
              <span className="tick" style={{ left: "70%" }} />
            </div>
            <p id="estimator-note" className="muted">
              Result from the trained network, version {state.version}. Bands use the same 30 and 70
              cut-offs as the full system, which also weighs the task, edit and communication scores,
              so a dashboard score can differ. Nothing you enter here is stored.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
