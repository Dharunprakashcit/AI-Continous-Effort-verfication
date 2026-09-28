/**
 * Decision Agent: turns the fused risk into an action.
 *   risk < 30        -> ALLOW  (monitor passively)
 *   30 <= risk <= 70  -> NUDGE  (in-app reminder to the student)
 *   risk > 70         -> ALERT  (surfaced to faculty dashboard)
 */
function decide({ overallRisk, notes }) {
  let decision;
  let recommendation;

  if (overallRisk < 30) {
    decision = "ALLOW";
    recommendation = "No action needed - contribution is healthy.";
  } else if (overallRisk <= 70) {
    decision = "NUDGE";
    recommendation = "Send an automated contribution reminder to the student.";
  } else {
    decision = "ALERT";
    recommendation = "Notify faculty - sustained low contribution detected.";
  }

  return { decision, recommendation, explanations: notes };
}

module.exports = { decide };
