/**
 * Task Agent: scores task completion rate and deadline adherence.
 */
function scoreTasks(tasks) {
  if (!tasks.length) {
    return {
      score: 30,
      tasksCompletedPct: 0,
      deadlineAdherencePct: 0,
      notes: ["No tasks have been assigned yet."],
    };
  }

  const completed = tasks.filter((t) => t.status === "Completed");
  const late = tasks.filter((t) => t.status === "Late");
  const tasksCompletedPct = Math.round((completed.length / tasks.length) * 100);

  const onTimeCompleted = completed.filter(
    (t) => t.completedAt && t.completedAt <= t.deadline
  );
  const deadlineAdherencePct = completed.length
    ? Math.round((onTimeCompleted.length / completed.length) * 100)
    : 100;

  const score = Math.round(tasksCompletedPct * 0.7 + deadlineAdherencePct * 0.3);

  const notes = [];
  if (tasksCompletedPct < 40) {
    notes.push(`Only ${tasksCompletedPct}% of assigned tasks completed.`);
  }
  if (late.length > 0) {
    notes.push(`${late.length} task(s) marked late.`);
  }

  return { score, tasksCompletedPct, deadlineAdherencePct, notes };
}

module.exports = { scoreTasks };
