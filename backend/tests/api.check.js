/**
 * API verification script. Runs real requests against a freshly seeded backend
 * (npm run demo) and the ANN service, records pass or fail for each check, and
 * measures request latency. Writes tests/api.check.results.json.
 *
 *   node tests/api.check.js [apiBase] [annBase]
 *
 * It mutates data (connects Classroom, creates a team), so restart the demo
 * server before running it again.
 */
const fs = require("fs");
const path = require("path");

const API = process.argv[2] || "http://localhost:5000/api";
const ANN = process.argv[3] || "http://localhost:5001";
const PASSWORD = "password123";

const results = [];

async function call(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}

const login = async (email) => (await call("POST", `${API}/auth/login`, null, { email, password: PASSWORD })).json.token;

async function check(id, component, name, expected, fn) {
  let actual;
  let pass = false;
  try {
    const out = await fn();
    pass = out.pass;
    actual = out.actual;
  } catch (err) {
    actual = `Error: ${err.message}`;
  }
  results.push({ id, component, name, expected, actual: String(actual), status: pass ? "Pass" : "Fail" });
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const pick = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, median_ms: +pick(0.5).toFixed(1), p95_ms: +pick(0.95).toFixed(1), max_ms: +s[s.length - 1].toFixed(1) };
}

async function timed(label, n, fn) {
  const samples = [];
  await fn();
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await fn();
    samples.push(performance.now() - t);
  }
  return { endpoint: label, ...stats(samples) };
}

(async () => {
  const F = await login("faculty@example.edu");
  const dharun = await login("23cs001@example.edu"); // Team 1
  const meena = await login("23cs005@example.edu"); // Team 2
  const naveen = await login("23cs008@example.edu"); // no Assignment 2 team
  const rekha = await login("23cs009@example.edu");

  // Authentication and authorization
  await check("T01", "Auth", "Login with correct credentials", "200, token and role returned", async () => {
    const r = await call("POST", `${API}/auth/login`, null, { email: "faculty@example.edu", password: PASSWORD });
    return { pass: r.status === 200 && !!r.json.token && r.json.user.role === "faculty", actual: `${r.status}, role ${r.json?.user?.role}` };
  });
  await check("T02", "Auth", "Login with wrong password", "401", async () => {
    const r = await call("POST", `${API}/auth/login`, null, { email: "faculty@example.edu", password: "wrong" });
    return { pass: r.status === 401, actual: r.status };
  });
  await check("T03", "Auth", "Protected route without token", "401", async () => {
    const r = await call("GET", `${API}/faculty/teams`);
    return { pass: r.status === 401, actual: r.status };
  });
  await check("T04", "Authorization", "Student token on a faculty route", "403", async () => {
    const r = await call("GET", `${API}/faculty/teams`, dharun);
    return { pass: r.status === 403, actual: r.status };
  });
  await check("T05", "Authorization", "Faculty token on a student route", "403", async () => {
    const r = await call("GET", `${API}/students/me/dashboard`, F);
    return { pass: r.status === 403, actual: r.status };
  });

  // Classroom sync
  await check("T06", "Classroom", "Sync before connecting", "400", async () => {
    const r = await call("POST", `${API}/classroom/sync`, F, { courseId: "aml" });
    return { pass: r.status === 400, actual: r.status };
  });
  await check("T07", "Classroom", "Assignments hidden before sync", "Empty list", async () => {
    const r = await call("GET", `${API}/assignments`, F);
    return { pass: r.status === 200 && r.json.length === 0, actual: `${r.json.length} assignments` };
  });
  await check("T08", "Classroom", "Connect Classroom", "200, connected", async () => {
    const r = await call("POST", `${API}/classroom/connect`, F);
    return { pass: r.status === 200 && r.json.connected === true, actual: r.status };
  });
  await check("T09", "Classroom", "Sync unknown course", "400", async () => {
    const r = await call("POST", `${API}/classroom/sync`, F, { courseId: "nope" });
    return { pass: r.status === 400, actual: r.status };
  });
  let sync;
  await check("T10", "Classroom", "Sync course aml", "3 assignments (2 individual, 1 team), 27 records", async () => {
    const r = await call("POST", `${API}/classroom/sync`, F, { courseId: "aml" });
    sync = r.json;
    const types = (sync.imported || []).map((i) => i.type).sort().join(",");
    return { pass: r.status === 200 && sync.imported.length === 3 && types === "individual,individual,team" && sync.records === 27, actual: `${sync.imported?.length} assignments (${types}), ${sync.records} records` };
  });
  await check("T11", "Classroom", "Second sync is idempotent", "Still 3 assignments, 27 records", async () => {
    const r = await call("POST", `${API}/classroom/sync`, F, { courseId: "aml" });
    const list = await call("GET", `${API}/assignments`, F);
    return { pass: r.json.records === 27 && list.json.length === 3, actual: `${list.json.length} assignments, ${r.json.records} records` };
  });

  const list = (await call("GET", `${API}/assignments`, F)).json;
  const team = list.find((a) => a.type === "team");
  const individual = list.filter((a) => a.type === "individual");

  // Contribution calculation
  const detail = (await call("GET", `${API}/assignments/${team.id}`, F)).json;
  const breakdowns = [];
  for (const r of detail.rows) breakdowns.push((await call("GET", `${API}/assignments/${team.id}/teams/${r.team.id}`, F)).json);

  await check("T12", "Contribution", "Team shares sum to 100", "Every team sums to exactly 100", async () => {
    const sums = breakdowns.map((b) => b.rows.reduce((a, r) => a + r.contribution, 0));
    return { pass: sums.every((s) => s === 100), actual: sums.join(", ") };
  });
  await check("T13", "Contribution", "Shares are whole percents in 0 to 100", "All integers in range", async () => {
    const all = breakdowns.flatMap((b) => b.rows.map((r) => r.contribution));
    return { pass: all.every((v) => Number.isInteger(v) && v >= 0 && v <= 100), actual: `${all.length} shares checked` };
  });
  await check("T14", "Contribution", "Component weights", "40, 30, 10, 10, 10", async () => {
    const w = breakdowns[0].weights.map((x) => x.weight).join(", ");
    return { pass: w === "40, 30, 10, 10, 10", actual: w };
  });
  await check("T15", "Contribution", "Individual contribution is 100 if submitted else 0", "All rows consistent", async () => {
    let ok = true;
    let rows = 0;
    for (const a of individual) {
      const d = (await call("GET", `${API}/assignments/${a.id}`, F)).json;
      for (const r of d.rows) {
        rows += 1;
        if (r.contribution !== (r.submitted ? 100 : 0)) ok = false;
      }
    }
    return { pass: ok, actual: `${rows} rows checked` };
  });

  // Dataset export
  const csv0 = (await call("GET", `${API}/assignments/dataset.csv`, F)).text;
  const lines0 = csv0.trim().split("\n");
  const required = "student_id,assignment_id,assignment_type,team_id,attendance,assignment_score,submission_status,late_submission,comments_count,relevant_comments,tasks_completed,project_interactions,activity_score,contribution_score";
  await check("T16", "Dataset", "CSV header has the 14 required columns", "Exact match", async () => ({ pass: lines0[0] === required, actual: `${lines0[0].split(",").length} columns` }));
  await check("T17", "Dataset", "CSV has one row per student per assignment", "27 rows", async () => ({ pass: lines0.length - 1 === 27, actual: `${lines0.length - 1} rows` }));

  // Student portal
  const mine = (await call("GET", `${API}/my/assignments`, dharun)).json;
  await check("T18", "Student portal", "Student lists all synced assignments", "3 assignments", async () => ({ pass: mine.length === 3, actual: `${mine.length}` }));
  const myTeamAssignment = mine.find((a) => a.type === "team");
  await check("T19", "Student portal", "Team assignment returns own team and members", "Team 1 with 3 members", async () => {
    const d = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}`, dharun)).json;
    const sum = d.myTeam.members.reduce((a, m) => a + m.contribution, 0);
    return { pass: d.myTeam.name === "Team 1" && d.myTeam.members.length === 3 && sum === 100 && d.canCreateTeam === false, actual: `${d.myTeam?.name}, ${d.myTeam?.members.length} members, sum ${sum}` };
  });
  await check("T20", "Student portal", "Student with no team can create one", "canCreateTeam true", async () => {
    const d = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}`, naveen)).json;
    return { pass: d.canCreateTeam === true && d.myTeam === null, actual: `canCreateTeam ${d.canCreateTeam}` };
  });
  const dTeam = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}`, dharun)).json;
  const teammate = dTeam.myTeam.members.find((m) => !m.isMe);
  await check("T21", "Student portal", "Teammate contribution analysis", "200 with the five signals", async () => {
    const r = await call("GET", `${API}/my/assignments/${myTeamAssignment.id}/members/${teammate.id}`, dharun);
    const keys = Object.keys(r.json.signals || {}).sort().join(",");
    return { pass: r.status === 200 && keys === "commentsDiscussions,projectActivity,relevantInteractions,submissions,tasksCompleted", actual: `${r.status}, ${keys}` };
  });
  await check("T22", "Privacy", "Student without a team opens a member analysis", "403", async () => {
    const r = await call("GET", `${API}/my/assignments/${myTeamAssignment.id}/members/${teammate.id}`, naveen);
    return { pass: r.status === 403, actual: r.status };
  });
  const meenaView = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}`, meena)).json;
  const otherMember = dTeam.myTeam.members.find((m) => m.isMe);
  await check("T23", "Privacy", "Student opens a member of another team", "404", async () => {
    const r = await call("GET", `${API}/my/assignments/${myTeamAssignment.id}/members/${otherMember.id}`, meena);
    return { pass: r.status === 404 && meenaView.myTeam.name === "Team 2", actual: r.status };
  });

  // Team creation
  const avail = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}/available-students`, naveen)).json;
  const naveenId = avail.find((s) => s.isMe).id;
  const rekhaId = avail.find((s) => !s.isMe).id;
  const dharunSelf = dTeam.myTeam.members.find((m) => m.isMe).id;

  await check("T24", "Teams", "Available students are those without a team", "2 (Naveen, Rekha)", async () => ({ pass: avail.length === 2, actual: avail.map((s) => s.name).join(", ") }));
  await check("T25", "Teams", "Create team with fewer than two members", "400", async () => {
    const r = await call("POST", `${API}/my/assignments/${myTeamAssignment.id}/teams`, naveen, { name: "Solo", memberIds: [] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });
  await check("T26", "Teams", "Create team with a student already on a team", "400", async () => {
    const r = await call("POST", `${API}/my/assignments/${myTeamAssignment.id}/teams`, naveen, { name: "Mixed", memberIds: [dharunSelf] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });
  await check("T27", "Teams", "Student already on a team tries to create one", "400", async () => {
    const r = await call("POST", `${API}/my/assignments/${myTeamAssignment.id}/teams`, dharun, { name: "Another", memberIds: [naveenId] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });
  await check("T28", "Teams", "Team creation on an individual assignment", "400", async () => {
    const r = await call("POST", `${API}/my/assignments/${individual[0].id}/teams`, naveen, { name: "Wrong", memberIds: [rekhaId] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });
  await check("T29", "Teams", "Duplicate team name (case-insensitive)", "400", async () => {
    const r = await call("POST", `${API}/my/assignments/${myTeamAssignment.id}/teams`, naveen, { name: "team 1", memberIds: [rekhaId] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });
  let created;
  await check("T30", "Teams", "Valid team creation ignores any supplied contribution values", "201 and shares computed by the system", async () => {
    const r = await call("POST", `${API}/my/assignments/${myTeamAssignment.id}/teams`, naveen, { name: "Team 4", memberIds: [rekhaId], contribution: { [naveenId]: 99, [rekhaId]: 1 }, percentages: [99, 1] });
    created = r.json;
    const d = (await call("GET", `${API}/my/assignments/${myTeamAssignment.id}`, naveen)).json;
    const shares = d.myTeam?.members.map((m) => m.contribution) || [];
    return { pass: r.status === 201 && shares.reduce((a, b) => a + b, 0) === 100 && !shares.includes(99), actual: `${r.status}, shares ${shares.join("/")}` };
  });
  await check("T31", "Teams", "No students remain available afterwards", "0", async () => {
    const r = await call("GET", `${API}/my/assignments/${myTeamAssignment.id}/available-students`, rekha);
    return { pass: r.json.length === 0, actual: r.json.length };
  });
  await check("T32", "Dataset", "Records rebuilt after team creation", "Naveen row has team_id Team 4", async () => {
    const csv = (await call("GET", `${API}/assignments/dataset.csv`, F)).text;
    const row = csv.split("\n").find((l) => l.startsWith("23CS008,cw-2"));
    return { pass: !!row && row.split(",")[3] === "Team 4", actual: row };
  });
  await check("T33", "Teams", "Faculty create team validates in the same way", "400 for unavailable students", async () => {
    const r = await call("POST", `${API}/assignments/${team.id}/teams`, F, { name: "Faculty team", memberIds: [dharunSelf, naveenId] });
    return { pass: r.status === 400, actual: `${r.status} ${r.json.error}` };
  });

  // Effort monitoring and input validation
  await check("T34", "Validation", "Activity counts are clamped to 0 to 500", "Negative becomes 0, large becomes 500", async () => {
    const before = (await call("POST", `${API}/students/me/activity`, rekha, {})).json;
    const after = (await call("POST", `${API}/students/me/activity`, rekha, { docEdits: -5, commits: 9999 })).json;
    const dDocs = after.docEdits - before.docEdits;
    const dCommits = after.commits - before.commits;
    return { pass: dDocs === 0 && dCommits === 500, actual: `docEdits +${dDocs}, commits +${dCommits}` };
  });
  await check("T35", "Validation", "Invalid task status", "400", async () => {
    const dash = (await call("GET", `${API}/students/me/dashboard`, dharun)).json;
    const r = await call("PATCH", `${API}/students/me/tasks/${dash.tasks[0]._id}`, dharun, { status: "Bogus" });
    return { pass: r.status === 400, actual: r.status };
  });
  await check("T36", "Agents", "Risk level and decision follow the 30 and 70 thresholds", "Consistent for every student", async () => {
    const teams = (await call("GET", `${API}/faculty/teams`, F)).json;
    let n = 0;
    let ok = true;
    for (const t of teams) {
      const ov = (await call("GET", `${API}/faculty/teams/${t._id}/overview`, F)).json;
      for (const r of ov.rows) {
        const d = (await call("GET", `${API}/faculty/students/${r.student.id}/detail`, F)).json;
        const p = d.latest;
        if (!p) continue;
        n += 1;
        const level = p.overallRisk < 30 ? "LOW" : p.overallRisk <= 70 ? "MEDIUM" : "HIGH";
        const decision = p.overallRisk < 30 ? "ALLOW" : p.overallRisk <= 70 ? "NUDGE" : "ALERT";
        if (p.riskLevel !== level || p.decision !== decision || p.overallRisk + p.contributionScore !== 100) ok = false;
      }
    }
    return { pass: ok && n > 0, actual: `${n} students checked` };
  });
  await check("T37", "Agents", "Every prediction carries written reasons", "Non-empty explanations", async () => {
    const alerts = (await call("GET", `${API}/faculty/alerts`, F)).json;
    return { pass: alerts.length > 0 && alerts.every((a) => a.reason && a.reason.length > 0), actual: `${alerts.length} alerts, all with reasons` };
  });
  await check("T38", "Feedback loop", "Incorrect feedback flips the exported label", "Exported label is the opposite of the prediction", async () => {
    const teams = (await call("GET", `${API}/faculty/teams`, F)).json;
    const ov = (await call("GET", `${API}/faculty/teams/${teams[0]._id}/overview`, F)).json;
    const d = (await call("GET", `${API}/faculty/students/${ov.rows[0].student.id}/detail`, F)).json;
    const predictedAtRisk = d.latest.riskLevel !== "LOW" ? 1 : 0;
    await call("POST", `${API}/faculty/predictions/${d.latest._id}/feedback`, F, { correct: false, comment: "check" });
    const rows = (await call("GET", `${API}/faculty/feedback-export`, F)).json;
    return { pass: rows.length === 1 && rows[0].risk_label === 1 - predictedAtRisk, actual: `predicted ${predictedAtRisk}, exported ${rows[0]?.risk_label}` };
  });

  // ANN and academic risk services
  const features = { tasks_completed_pct: 10, doc_edits: 1, messages_sent: 0, commits: 0, deadline_adherence_pct: 20, active_days_last7: 1 };
  await check("T39", "ANN service", "Predict returns a probability in [0, 1]", "0 <= p <= 1", async () => {
    const r = await call("POST", `${ANN}/predict`, null, { ...features, log: false });
    return { pass: r.status === 200 && r.json.risk_probability >= 0 && r.json.risk_probability <= 1, actual: r.json.risk_probability };
  });
  await check("T40", "ANN service", "Predict with a missing feature", "400", async () => {
    const r = await call("POST", `${ANN}/predict`, null, { doc_edits: 1 });
    return { pass: r.status === 400, actual: r.status };
  });
  await check("T41", "ANN service", "Low activity scores riskier than high activity", "p(low) > p(high)", async () => {
    const hi = await call("POST", `${ANN}/predict`, null, { tasks_completed_pct: 90, doc_edits: 30, messages_sent: 20, commits: 12, deadline_adherence_pct: 95, active_days_last7: 7, log: false });
    const lo = await call("POST", `${ANN}/predict`, null, { ...features, log: false });
    return { pass: lo.json.risk_probability > hi.json.risk_probability, actual: `low ${lo.json.risk_probability}, high ${hi.json.risk_probability}` };
  });
  await check("T42", "ANN service", "Estimator requests are not logged for drift", "Drift sample count unchanged", async () => {
    const before = (await call("GET", `${ANN}/model/drift`)).json.live_samples;
    await call("POST", `${ANN}/predict`, null, { ...features, log: false });
    const after = (await call("GET", `${ANN}/model/drift`)).json.live_samples;
    return { pass: before === after, actual: `${before} to ${after}` };
  });
  await check("T43", "AML", "Model comparison lists five models", "5", async () => {
    const r = await call("GET", `${ANN}/model/info`);
    return { pass: Object.keys(r.json.comparison).length === 5, actual: Object.keys(r.json.comparison).length };
  });
  await check("T44", "Academic risk", "Student analysis uses the trained model", "source is model", async () => {
    const r = await call("GET", `${API}/assignments/${individual[0].id}/students/${dharunSelf}`, F);
    return { pass: r.status === 200 && r.json.academicRisk.source === "model" && r.json.academicRisk.probability >= 0 && r.json.academicRisk.probability <= 1, actual: `${r.json.academicRisk?.source}, p ${r.json.academicRisk?.probability}` };
  });
  await check("T45", "Academic risk", "Academic risk ranks a free-rider above a strong student", "p(Meena) > p(Dharun)", async () => {
    const meenaId = meenaView.myTeam.members.find((m) => m.isMe).id;
    const a = await call("GET", `${API}/assignments/${individual[0].id}/students/${meenaId}`, F);
    const b = await call("GET", `${API}/assignments/${individual[0].id}/students/${dharunSelf}`, F);
    return { pass: a.json.academicRisk.probability > b.json.academicRisk.probability, actual: `Meena ${a.json.academicRisk.probability}, Dharun ${b.json.academicRisk.probability}` };
  });

  // Latency
  const tid = detail.rows[0].team.id;
  const latency = [
    await timed("POST ANN /predict", 30, () => call("POST", `${ANN}/predict`, null, { ...features, log: false })),
    await timed("POST ANN /academic/predict", 30, () => call("POST", `${ANN}/academic/predict`, null, { attendance_pct: 80, internal_marks: 60, previous_gpa: 7, submission_rate_pct: 80, late_submissions: 1, avg_assignment_score: 60, contribution_ratio: 1, tasks_completed_pct: 70 })),
    await timed("GET /api/my/assignments (student)", 30, () => call("GET", `${API}/my/assignments`, dharun)),
    await timed("GET /api/assignments/:id/teams/:teamId (faculty)", 30, () => call("GET", `${API}/assignments/${team.id}/teams/${tid}`, F)),
    await timed("GET /api/faculty/analytics (faculty)", 30, () => call("GET", `${API}/faculty/analytics`, F)),
    await timed("GET /api/assignments/dataset.csv (faculty)", 30, () => call("GET", `${API}/assignments/dataset.csv`, F)),
  ];

  const passed = results.filter((r) => r.status === "Pass").length;
  const out = { ran_at: new Date().toISOString(), api: API, ann: ANN, summary: { total: results.length, passed, failed: results.length - passed }, results, latency };
  fs.writeFileSync(path.join(__dirname, "api.check.results.json"), JSON.stringify(out, null, 2));

  for (const r of results) console.log(`${r.status === "Pass" ? "PASS" : "FAIL"}  ${r.id}  ${r.component}: ${r.name}  [${r.actual}]`);
  console.log(`\n${passed}/${results.length} passed`);
  console.table(latency);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
