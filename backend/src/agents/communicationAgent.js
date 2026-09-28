/**
 * Communication Agent: scores discussion participation - messages sent
 * and replies given to teammates (helping others is weighted higher
 * than raw message volume).
 */
function scoreCommunication({ messagesSent, repliesGiven, activeDaysLast7 }) {
  const raw = Math.sqrt(messagesSent) * 2 + Math.sqrt(repliesGiven) * 3;
  const score = Math.min(100, Math.round(raw * 5));

  const notes = [];
  if (messagesSent + repliesGiven < 3) {
    notes.push("Low discussion participation over the last 7 days.");
  }
  if (activeDaysLast7 !== undefined && activeDaysLast7 < 2) {
    notes.push(`Active on only ${activeDaysLast7} of the last 7 days.`);
  }

  return { score, messagesSent, repliesGiven, notes };
}

module.exports = { scoreCommunication };
