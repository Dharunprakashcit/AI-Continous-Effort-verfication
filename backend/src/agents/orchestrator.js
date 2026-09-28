const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Prediction = require("../models/Prediction");

const { scoreEdits } = require("./editAgent");
const { scoreTasks } = require("./taskAgent");
const { scoreCommunication } = require("./communicationAgent");
const { getAnnRiskProbability, fuseScores } = require("./riskAgent");
const { decide } = require("./decisionAgent");

const WINDOW_DAYS = 7;

/**
 * Runs the full agent pipeline for one student and persists the result.
 * Orchestrator -> {Edit, Task, Communication} agents -> Risk Agent (+ANN)
 * -> Decision Agent -> Prediction record.
 */
async function runPipelineForStudent(studentId, teamId) {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [tasks, activities] = await Promise.all([
    Task.find({ assignedTo: studentId }).lean(),
    Activity.find({ student: studentId, date: { $gte: since } }).lean(),
  ]);

  const agg = activities.reduce(
    (acc, a) => {
      acc.docEdits += a.docEdits;
      acc.commits += a.commits;
      acc.messagesSent += a.messagesSent;
      acc.repliesGiven += a.repliesGiven;
      return acc;
    },
    { docEdits: 0, commits: 0, messagesSent: 0, repliesGiven: 0 }
  );
  const activeDaysLast7 = new Set(
    activities.map((a) => new Date(a.date).toDateString())
  ).size;

  const editResult = scoreEdits(agg);
  const taskResult = scoreTasks(tasks);
  const commResult = scoreCommunication({ ...agg, activeDaysLast7 });

  const annFeatures = {
    tasks_completed_pct: taskResult.tasksCompletedPct,
    doc_edits: agg.docEdits,
    messages_sent: agg.messagesSent,
    commits: agg.commits,
    deadline_adherence_pct: taskResult.deadlineAdherencePct,
    active_days_last7: activeDaysLast7,
  };
  const { riskProbability, source } = await getAnnRiskProbability(annFeatures);

  const fused = fuseScores({
    editScore: editResult.score,
    taskScore: taskResult.score,
    communicationScore: commResult.score,
    annRiskProbability: riskProbability,
  });

  const notes = [...editResult.notes, ...taskResult.notes, ...commResult.notes];
  if (notes.length === 0) {
    notes.push("Activity levels are consistent with normal contribution.");
  }
  notes.push(
    `ANN model estimates ${(riskProbability * 100).toFixed(1)}% risk probability (${source}).`
  );

  const decision = decide({ overallRisk: fused.overallRisk, notes });

  const prediction = await Prediction.create({
    student: studentId,
    team: teamId,
    editScore: editResult.score,
    taskScore: taskResult.score,
    communicationScore: commResult.score,
    annRiskProbability: riskProbability,
    overallRisk: fused.overallRisk,
    contributionScore: fused.contributionScore,
    riskLevel: fused.riskLevel,
    decision: decision.decision,
    explanations: decision.explanations,
    recommendation: decision.recommendation,
    featuresUsed: annFeatures,
  });

  return prediction;
}

module.exports = { runPipelineForStudent };
