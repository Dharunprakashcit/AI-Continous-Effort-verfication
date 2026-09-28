/**
 * Edit Agent: scores a student's document/code contribution volume.
 * Uses diminishing returns (sqrt) so 40 edits isn't literally "4x" as
 * good as 10 - it rewards sustained activity without letting a single
 * edit-spam day dominate the score.
 */
function scoreEdits({ docEdits, commits }) {
  const raw = Math.sqrt(docEdits) * 1.5 + Math.sqrt(commits) * 2.5;
  const score = Math.min(100, Math.round(raw * 4));

  const notes = [];
  if (docEdits < 3 && commits < 2) {
    notes.push("Very few document edits or commits recorded in this window.");
  } else if (docEdits + commits > 15) {
    notes.push("Strong, sustained editing/commit activity.");
  }

  return { score, docEdits, commits, notes };
}

module.exports = { scoreEdits };
