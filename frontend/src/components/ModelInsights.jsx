import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ModelInsights() {
  const [info, setInfo] = useState(null);
  const [drift, setDrift] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([axios.get("/ann/model/info"), axios.get("/ann/model/drift")])
      .then(([i, d]) => {
        setInfo(i.data);
        setDrift(d.data);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <section className="card">
        <h3>ML Model Monitoring</h3>
        <p className="muted">ANN service unreachable.</p>
      </section>
    );
  }
  if (!info) return null;

  const rows = Object.entries(info.comparison);

  return (
    <section className="card">
      <h3>ML Model Monitoring</h3>
      <p className="muted">
        Serving: {info.serving.model}, version {info.serving.version}
      </p>

      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>CV F1</th>
            <th>Test F1</th>
            <th>Test ROC-AUC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, m]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{m.cv_f1_mean != null ? m.cv_f1_mean.toFixed(3) : "-"}</td>
              <td>{m.test.f1.toFixed(3)}</td>
              <td>{m.test.roc_auc.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12 }}>
        Data drift:{" "}
        <strong>
          {drift.status === "insufficient_data"
            ? `not enough live data yet (${drift.live_samples}/${drift.min_required} predictions)`
            : drift.status === "stable"
            ? "stable"
            : `detected in ${drift.drifted_features.join(", ")}`}
        </strong>
      </p>
    </section>
  );
}
