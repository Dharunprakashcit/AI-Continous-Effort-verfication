const axios = require("axios");

const ANN_URL = process.env.ANN_SERVICE_URL || "http://127.0.0.1:5001";

/**
 * Risk Agent: fuses the Edit/Task/Communication agent scores with the
 * ANN's learned risk probability into one overall risk (0-100, higher
 * = more likely free-riding). If the ANN microservice is unreachable
 * (e.g. not started for a quick demo), falls back to a rule-based
 * estimate so the pipeline never hard-fails.
 */
async function getAnnRiskProbability(features) {
  try {
    const { data } = await axios.post(`${ANN_URL}/predict`, features, {
      timeout: 3000,
    });
    return { riskProbability: data.risk_probability, source: "ann" };
  } catch (err) {
    // Fallback heuristic mirrors the same latent-effort formula used to
    // label the synthetic training data, so behaviour degrades gracefully.
    const latent =
      0.3 * (features.tasks_completed_pct / 100) +
      0.2 * Math.tanh(features.doc_edits / 20) +
      0.15 * Math.tanh(features.messages_sent / 15) +
      0.15 * Math.tanh(features.commits / 10) +
      0.15 * (features.deadline_adherence_pct / 100) +
      0.05 * (features.active_days_last7 / 7);
    return {
      riskProbability: Math.max(0, Math.min(1, 1 - latent)),
      source: "fallback-heuristic",
    };
  }
}

function fuseScores({ editScore, taskScore, communicationScore, annRiskProbability }) {
  const annRiskPct = annRiskProbability * 100;
  const contributionScore = Math.round(
    0.3 * editScore + 0.35 * taskScore + 0.15 * communicationScore + 0.2 * (100 - annRiskPct)
  );
  const overallRisk = 100 - contributionScore;

  let riskLevel;
  if (overallRisk < 30) riskLevel = "LOW";
  else if (overallRisk <= 70) riskLevel = "MEDIUM";
  else riskLevel = "HIGH";

  return { contributionScore, overallRisk, riskLevel };
}

module.exports = { getAnnRiskProbability, fuseScores };
