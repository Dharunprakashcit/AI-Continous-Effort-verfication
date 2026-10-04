import React, { useEffect, useState } from "react";

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function ModelResults() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let live = true;
    fetch("/ann/model/info")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => live && setState({ status: "done", data }))
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div aria-label="Loading model results">
        <div className="skeleton line short" />
        <div className="skeleton block" />
        <div className="skeleton block" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="muted">
        Model results are unavailable because the prediction service is not reachable.
      </p>
    );
  }

  const { ann_metrics: m, comparison } = state.data;

  return (
    <div className="results-grid">
      <div>
        <h3>Deployed network</h3>
        <dl className="metrics">
          <div><dt>Accuracy</dt><dd>{pct(m.accuracy)}</dd></div>
          <div><dt>Precision</dt><dd>{pct(m.precision)}</dd></div>
          <div><dt>Recall</dt><dd>{pct(m.recall)}</dd></div>
          <div><dt>F1 score</dt><dd>{pct(m.f1_score)}</dd></div>
          <div><dt>ROC-AUC</dt><dd>{m.roc_auc.toFixed(3)}</dd></div>
        </dl>
        <p className="muted">
          Scored on {m.n_test} records held out from training. Of those, {m.confusion_matrix[1][1]} at
          risk students were found and {m.confusion_matrix[1][0]} were missed.
        </p>
      </div>

      <div>
        <h3>Compared with other models</h3>
        <div className="table-scroll">
          <table className="plain">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Test F1</th>
                <th scope="col">Test ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(comparison).map(([name, r]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{r.test.f1.toFixed(3)}</td>
                  <td>{r.test.roc_auc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
