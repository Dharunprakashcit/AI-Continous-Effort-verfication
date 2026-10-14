// Builds the ANN report (HTML, then PDF through Edge). Every number comes from the
// recorded result files, so the text cannot drift from the evidence.
//   node build-report.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const REFS = require("./refs.js");

const DIR = __dirname;
const ROOT = path.join(DIR, "..", "..");
const exp = require("./ann_experiments.json");
const chk = require("./ann_service_checks.json");
const lat = require("./ann_latency.json");
const shots = require("./screenshots-info.json");
const metrics = require(path.join(ROOT, "ann-service", "metrics.json"));
const aml = require(path.join(ROOT, "ann-service", "aml_report.json"));

// ---------- helpers ----------
const f2 = (x) => Number(x).toFixed(2);
const f3 = (x) => Number(x).toFixed(3);
const f4 = (x) => Number(x).toFixed(4);
const pc = (x, d = 1) => (Number(x) * 100).toFixed(d) + "%";
const roman = (n) => ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"][n];
const TODO = (t = "TO BE PROVIDED") => `<span class="todo">[${t}]</span>`;

const cites = []; // keys in order of first citation
const cite = (...keys) =>
  "[" +
  keys
    .map((k) => {
      if (!REFS[k]) throw new Error("Unknown reference " + k);
      let i = cites.indexOf(k);
      if (i < 0) { cites.push(k); i = cites.length - 1; }
      return i + 1;
    })
    .join("], [") +
  "]";

let secNo = 0, subNo = 0, tblNo = 0, figNo = 0;
const labels = {};
const S = (title) => { secNo += 1; subNo = 0; return `<h2>${roman(secNo)}. ${title}</h2>`; };
const sub = (title) => { subNo += 1; return `<h3>${String.fromCharCode(64 + subNo)}. ${title}</h3>`; };
const ref = (key) => `{{${key}}}`;

function T(key, caption, head, rows, opts = {}) {
  tblNo += 1;
  labels[key] = `Table ${roman(tblNo)}`;
  const align = opts.align || [];
  const th = head.map((h, i) => `<th class="${align[i] === "n" ? "n" : ""}">${h}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${align[i] === "n" ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("");
  const html = `<div class="tbl"><div class="cap">TABLE ${roman(tblNo)}<br/>${caption.toUpperCase()}</div><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
  return opts.wide ? `<div class="wide">${html}</div>` : html;
}

function F(key, caption, imgs, opts = {}) {
  figNo += 1;
  labels[key] = `Fig. ${figNo}`;
  const list = Array.isArray(imgs) ? imgs : [imgs];
  const row = list.length > 1
    ? `<div style="display:flex;gap:2mm;justify-content:center;align-items:flex-end">${list.map((i) => `<img src="figures/${i.src}" style="width:${i.w}"/>`).join("")}</div>`
    : `<img src="figures/${list[0].src}" style="width:${list[0].w || "100%"}"/>`;
  const html = `<figure>${row}<div class="figcap">Fig. ${figNo}. ${caption}</div></figure>`;
  return opts.wide ? `<div class="wide">${html}</div>` : html;
}

const eq = (tex, n) => `<div class="eq">${tex}<span class="n">(${n})</span></div>`;

// ---------- numbers used in the text ----------
const A = exp.seed_variance.aggregate;
const rep = exp.reproduction;
const cm = exp.confusion_matrix;
const cal = exp.calibration;
const ceil = exp.rule_ceiling;
const imp = exp.permutation_importance;
const sens = exp.sensitivity;
const ds = exp.dataset;
const abl = chk.ablation;
const nl = (x) => x.toLocaleString("en-US");
const tn = cm[0][0], fp = cm[0][1], fn = cm[1][0], tp = cm[1][1];
const FEAT = {
  tasks_completed_pct: ["Tasks completed (%)", "Share of assigned tasks marked completed", "Task records"],
  doc_edits: ["Document edits", "Document edits in the last 7 days", "Activity records"],
  messages_sent: ["Messages sent", "Messages sent in the last 7 days", "Activity records"],
  commits: ["Commits", "Commits in the last 7 days", "Activity records"],
  deadline_adherence_pct: ["Deadline adherence (%)", "Share of completed tasks finished by their deadline (100 if none completed)", "Task records"],
  active_days_last7: ["Active days", "Distinct days with recorded activity in the last 7", "Activity records"],
};
const featKeys = Object.keys(FEAT);

// ---------- content ----------
const cover = `
<div class="cover">
  <div class="inst">${TODO("INSTITUTION NAME")}</div>
  <div class="small">${TODO("ADDRESS")}</div>
  <div class="small">${TODO("AFFILIATION, IF ANY")}</div>
  <div class="dept">DEPARTMENT OF ${TODO("DEPARTMENT")}</div>
  <div class="small">${TODO("PROGRAMME")}</div>
  <div class="small">Academic Year ${TODO("ACADEMIC YEAR")}</div>
  <div class="subject">ARTIFICIAL NEURAL NETWORKS ${TODO("COURSE CODE")}</div>
  <div class="doc">PROJECT REPORT</div>
  <h1>ANN-Based Free-Riding Risk Estimation for Continuous Effort Verification</h1>
  <div class="tag">The neural-network component of the Smart Team Contribution Monitoring System</div>
  <div class="two">
    <div><h3>SUBMITTED TO</h3><p>${TODO("FACULTY GUIDE NAME")}</p><p>${TODO("DESIGNATION")}</p><p>${TODO("DEPARTMENT")}</p></div>
    <div><h3>SUBMITTED BY</h3><p>${TODO("STUDENT NAME")}</p><p>${TODO("REGISTER NUMBER")}</p><p>${TODO("PROGRAMME AND YEAR")}</p></div>
  </div>
  <div class="note"><b>Reporting note.</b> This report covers only the artificial neural network (ANN) component of the project. All data used to train and evaluate the network is <b>simulated</b>; every performance figure describes the method on that data and is not evidence about real students. Items marked <span class="todo">[TO BE PROVIDED]</span> were not supplied and are left for the authors to complete.</div>
</div>`;

const titleBlock = `
<div class="title-block wide">
  <h1>ANN-Based Free-Riding Risk Estimation for Continuous Effort Verification in Collaborative Student Projects</h1>
  <div class="authors">${TODO("AUTHOR NAMES")}</div>
  <div class="aff">${TODO("PROGRAMME, DEPARTMENT")}, ${TODO("INSTITUTION")}</div>
  <div class="aff">Course project: Artificial Neural Networks | Faculty guide: ${TODO("FACULTY GUIDE")} | ${TODO("CITY, COUNTRY")} | October 2026</div>
</div>
<div class="abstract wide"><b>Abstract</b>\u2014Free-riding in student team projects is usually visible only at the end of the project, when peer review can no longer change the outcome. This paper describes and evaluates the artificial neural network (ANN) that estimates free-riding risk inside the Smart Team Contribution Monitoring System. The network is a feed-forward model with six inputs (task completion, document edits, messages, commits, deadline adherence and active days over a seven-day window), two ReLU hidden layers of 16 and 8 neurons, and a sigmoid output, giving 257 trainable parameters. It is served by a Flask microservice and called by a Node.js Risk Agent, where its probability contributes 20% of a fused contribution score; a rule-based fallback takes over if the service is unavailable. Because no public dataset of team free-riding exists, the network was trained on 4,000 simulated records with labels from a rule-based simulator. On 800 held-out records it reaches accuracy ${f3(metrics.accuracy)}, F1 ${f3(metrics.f1_score)} and ROC-AUC ${f3(metrics.roc_auc)}, reproduced exactly from the stored artifacts. Five retrainings vary by only \u00b1${f4(A.roc_auc.std)} AUC, and four classical baselines score within about 0.02 AUC. The labelling formula itself reaches AUC ${f3(ceil.roc_auc)}, so the network matches the ceiling of the simulator: the results show that it learned the simulated rule, not that it detects free-riding in real teams. Further analyses cover calibration (ECE ${f3(cal.ece)}), feature importance, monotonic sensitivity, noise robustness, service behaviour, and an ablation in which removing the network changes the decision for ${abl.changed_level} of ${abl.rows.length} demonstration students. Gaps found include unvalidated input ranges, a request latency of about ${Math.round(chk.latency_http.median_ms)} ms dominated by framework overhead, and the absence of real labelled data.</div>
<div class="keywords wide"><b>Index Terms</b>\u2014artificial neural network, free-riding detection, student team projects, learning analytics, feed-forward network, binary classification, model calibration, simulated data, decision support, human-in-the-loop</div>`;

const secI = `
${S("Introduction")}
${sub("Background")}
<p>Team projects are widely used to build collaboration skills, but they make individual effort hard to observe. Members who contribute less than their share while benefiting from the group result are described as free-riders or social loafers ${cite("kerr", "latane")}. A meta-analysis found that reduced individual effort in groups is a robust effect and proposed a collective effort model to explain it ${cite("karau")}, and studies of group projects report that non-contribution has causes beyond simple loafing ${cite("hall")}. The usual remedy is peer assessment near the end of a project, when it can no longer change how the work was done.</p>
${sub("Motivation")}
<p>Learning platforms already record who completed tasks, edited documents, committed code and took part in discussion. Learning analytics aims to turn such records into evidence that can support teaching decisions ${cite("siemens")}. A continuous estimate of effort would let a faculty member intervene while there is still time, and would give students concrete feedback before grades are decided.</p>
${sub("Problem Statement")}
<p>Given a student's recorded activity over the last seven days, estimate the probability that the student is contributing at the free-riding end of the range, and expose that probability to the rest of the system as one input to an explainable decision. The estimate must be fast enough to be requested on demand, must degrade gracefully when unavailable, and must leave the final judgement to faculty.</p>
${sub("Research Gap")}
<p>Educational data mining has mostly predicted overall performance or dropout ${cite("romero", "cortez")}, not in-project effort. For small tabular data, studies report that tree ensembles are often as good as or better than deep networks ${cite("shwartz", "grinsztajn")}, so a neural model needs to be compared with simple baselines rather than assumed to be superior. No public labelled dataset of team free-riding is available to the authors, which makes honest reporting of what simulated evaluation can and cannot show part of the problem.</p>
${sub("Proposed Approach")}
<p>The project uses a small feed-forward ANN trained on simulated activity records. The network is deployed as a microservice and consulted by a Risk Agent that fuses its output with three rule-based agent scores. The study evaluates the network on held-out data, retrains it under several random seeds, compares it with classical models and with the labelling rule, probes its behaviour with perturbations, and tests the running service.</p>
${sub("Objectives")}
<ol>
<li>Design and train a compact neural network that maps seven-day activity to a risk probability.</li>
<li>Serve the network behind a documented API and integrate it into the contribution pipeline with a fallback.</li>
<li>Evaluate discrimination, calibration, robustness and reproducibility on held-out data.</li>
<li>Compare the network with baselines and with the rule that generated the labels.</li>
<li>Measure what the network changes in the fused decision, and report limitations honestly.</li>
</ol>
${sub("Main Contributions")}
<ol>
<li>A 257-parameter network, its training script and a Flask service with a versioned response, implemented and running.</li>
<li>Integration into a fused Allow/Nudge/Alert decision, with a 3 s timeout and a rule-based fallback.</li>
<li>An evaluation that reproduces the stored metrics exactly and adds threshold, calibration, importance, sensitivity, noise, seed-variance, latency and ablation studies.</li>
<li>Evidence that the network reaches the noise ceiling of its simulator, and an explicit list of what this does not establish.</li>
</ol>
${sub("Scope and Assumptions")}
<p>This report covers only the ANN component. The surrounding platform (web interface, rule-based agents, assignment workflow, academic-risk model) is described only as context. All training and evaluation data is simulated. Claims are classified as shown in ${ref("tbl:evidence")}; the same classes are used throughout.</p>
${T("tbl:evidence", "Evidence classes used in this report", ["Class", "Meaning", "Examples in this report"], [
  ["Verified implementation", "Supported by code and by checks executed for this report", "Network, training script, service, integration, fallback, UI display, exact metric reproduction"],
  ["Simulated results", "Produced from the simulator or from demonstration data", "Dataset, labels, every accuracy, AUC and calibration figure, demonstration students"],
  ["Planned or claimed", "Described in project notes but not verified here", "Training on real labels, automated retraining, calibration, production deployment, fairness audit"],
])}
${sub("Organization of the Report")}
<p>Section II reviews related work. Sections III to V formulate the problem, describe the architecture and the methodology. Sections VI and VII cover implementation and workflow. Sections VIII and IX present the evaluation design and results, and Section X the testing. Sections XI to XIII describe the interface, security and deployment. Sections XIV to XVII give the discussion, limitations, future work and conclusion.</p>`;

const secII = `
${S("Related Work")}
${sub("Free-Riding in Student Teams")}
<p>Kerr and Bruun showed that members reduce effort when their contribution seems dispensable ${cite("kerr")}, and Latan\u00e9 et al. described social loafing as reduced individual effort in groups ${cite("latane")}. Karau and Williams synthesised the literature in a meta-analysis ${cite("karau")}. Hall and Buzwell argued that free-riding in student projects has several causes, which matters for how an alert should be phrased ${cite("hall")}. These works motivate detection but do not provide an automated, continuous measure.</p>
${sub("Learning Analytics and Performance Prediction")}
<p>Romero and Ventura reviewed educational data mining methods and applications ${cite("romero")}. Cortez and Silva predicted secondary-school performance with several data-mining models, including neural networks, on school records ${cite("cortez")}. Siemens and Long framed learning analytics as the use of learner data to inform decisions ${cite("siemens")}. This project applies a similar supervised pattern, but to a within-project effort signal.</p>
${sub("Neural Networks for Small Tabular Data")}
<p>Multilayer networks trained by back-propagation ${cite("rumelhart")} can approximate a wide class of functions ${cite("cybenko")}. On tabular data, however, Shwartz-Ziv and Armon found that tree-based models matched or exceeded recent deep models on several datasets ${cite("shwartz")}, and Grinsztajn et al. reported that tree-based models remain strong on medium-sized tabular data ${cite("grinsztajn")}. Random forests ${cite("breiman")} are one such baseline. The comparison in Section IX follows this advice by testing the network against classical models.</p>
${sub("Training Practices Used")}
<p>The network uses rectified linear units ${cite("nair")}, Glorot-style weight initialisation ${cite("glorot")}, the Adam optimiser ${cite("kingma")}, dropout ${cite("srivastava")} and early stopping on validation loss ${cite("prechelt")}. It is implemented with TensorFlow ${cite("tensorflow")} and preprocessing from scikit-learn ${cite("sklearn")}.</p>
${sub("Evaluation, Calibration, Drift and Oversight")}
<p>ROC analysis is the standard way to assess ranking quality independent of a threshold ${cite("fawcett")}. Probabilistic quality is measured with the Brier score ${cite("brier")} and with calibration curves; modern networks are often poorly calibrated ${cite("guo")}. Permutation importance gives a model-agnostic view of feature use ${cite("altmann")}. Input distributions can change after deployment, which is the concept-drift problem ${cite("gama")}. Interpretability needs rigorous evaluation rather than assertion ${cite("doshi")}, human feedback can improve interactive learning systems ${cite("amershi")}, and machine-learning systems accumulate maintenance costs beyond the model itself ${cite("sculley")}.</p>
${sub("Gap Addressed")}
<p>The literature establishes why free-riding matters and how models are trained and evaluated, but offers no labelled team-effort dataset. This work therefore contributes an implemented, integrated and candidly evaluated network on simulated data, rather than a claim of real-world accuracy.</p>`;

const secIII = `
${S("Problem Formulation")}
${sub("Problem Definition")}
<p>Let <i>x</i> \u2208 \u211d\u2076 be the activity vector of one student over a seven-day window. The network computes a probability <i>p</i> = <i>f</i>(<i>x</i>) \u2208 (0, 1) that the student is at risk of free-riding. With scaling parameters (\u03bc, \u03c3) fitted on training data, <i>z</i> = (<i>x</i> \u2212 \u03bc) / \u03c3 and</p>
${eq("h\u2081 = ReLU(W\u2081 z + b\u2081),&nbsp; h\u2082 = ReLU(W\u2082 h\u2081 + b\u2082),&nbsp; p = \u03c3(w\u2083\u1d40 h\u2082 + b\u2083)", 1)}
<p>where W\u2081 \u2208 \u211d\u00b9\u2076\u02e3\u2076, W\u2082 \u2208 \u211d\u2078\u02e3\u00b9\u2076 and \u03c3 is the logistic function. Training minimises binary cross-entropy:</p>
${eq("L = \u2212(1/N) \u03a3 [ y log p + (1 \u2212 y) log(1 \u2212 p) ]", 2)}
<p>For classification the rule is <i>p</i> &gt; 0.5. In the deployed system, however, <i>p</i> is used as a continuous input. The Risk Agent forms the contribution score from the three rule-based agent scores (edit <i>E</i>, task <i>T</i>, communication <i>C</i>, each 0 to 100) and the network:</p>
${eq("contribution = round( 0.30 E + 0.35 T + 0.15 C + 0.20 (100 \u2212 100 p) ),&nbsp; risk = 100 \u2212 contribution", 3)}
<p>The Decision Agent maps risk to Allow (below 30), Nudge (30 to 70) or Alert (above 70).</p>
${sub("Inputs")}
${T("tbl:features", "Network input features", ["Feature", "Definition", "Source"], featKeys.map((k) => [`<code>${k}</code>`, FEAT[k][1], FEAT[k][2]]))}
${sub("Outputs")}
<p>The service returns <code>risk_probability</code> (0 to 1, four decimals), <code>risk_percent</code>, the feature names used, and a <code>model_version</code> derived from the modification time of the model file. The backend stores the probability and the features on the prediction record.</p>
${sub("Users and Stakeholders")}
<p>Faculty read the probability as one line of an explained decision and can mark the prediction correct or incorrect. Students see the same value as an \u201cANN risk\u201d bar on their feedback page. A system administrator runs the service and watches drift.</p>
${sub("Functional Requirements")}
${T("tbl:fr", "Functional requirements for the ANN component", ["ID", "Requirement", "Status"], [
  ["F1", "Accept six numeric features and return a probability.", "Implemented"],
  ["F2", "Reject requests with missing or non-numeric features.", "Implemented"],
  ["F3", "Return the same output for the same input.", "Implemented"],
  ["F4", "Be called by the Risk Agent for every evaluation.", "Implemented"],
  ["F5", "Fall back to a rule-based estimate when unreachable.", "Implemented"],
  ["F6", "Store the probability and inputs with each prediction.", "Implemented"],
  ["F7", "Show the probability to students and faculty.", "Implemented"],
  ["F8", "Support retraining from faculty feedback.", "Script present, not run in this study"],
])}
${sub("Non-Functional Requirements")}
${T("tbl:nfr", "Non-functional requirements", ["Quality", "Target", "Observed"], [
  ["Latency", "Well inside the 3 s client timeout", `${Math.round(chk.latency_http.median_ms)} ms median over HTTP`],
  ["Reproducibility", "Stored metrics can be regenerated", `Max difference ${rep.max_abs_difference}`],
  ["Robustness", "Graceful with noisy inputs", `AUC ${f3(exp.noise_robustness[2].roc_auc)} at 0.25 SD noise`],
  ["Explainability", "Show how the value is used", "Shown with agent scores and written reasons"],
  ["Input safety", "Reject invalid inputs", "Partial: type checks only, no range checks"],
])}
${sub("Constraints and Assumptions")}
<p>Only seven-day aggregates are available, there are no real labels, and the service runs on a single CPU-only development machine. The study assumes that the simulator is a reasonable stand-in for the relationship between activity and effort; this assumption cannot be tested without real data.</p>
${sub("Decision and Processing Flow")}
<ol>
<li>A student logs activity, or faculty request a re-evaluation.</li>
<li>The orchestrator aggregates seven days of activity and the student's tasks.</li>
<li>The three agents score the evidence; the six features are derived.</li>
<li>The backend posts the features to the ANN service (3 s timeout).</li>
<li>The Risk Agent fuses the agent scores with <i>p</i> using Eq. (3).</li>
<li>The Decision Agent selects Allow, Nudge or Alert and writes reasons.</li>
<li>The prediction is stored and shown; faculty may review it.</li>
</ol>`;

const secIV = `
${S("System Architecture")}
${sub("ANN in the Overall System")}
<p>${ref("fig:context")} places the network in the system. The Node.js backend aggregates evidence and calls the Python service; the service holds the model and scaler in memory. The Risk Agent and Decision Agent run in the backend. Outputs reach three user-facing screens, and faculty feedback can feed retraining.</p>
${F("fig:context", "Context of the ANN: where it is called, how its output is fused, and where it appears.", { src: "a2.png", w: "96%" }, { wide: true })}
${sub("Components")}
${T("tbl:components", "Components involved in ANN inference", ["Component", "Responsibility", "Technology"], [
  ["Orchestrator", "Aggregates seven days of activity and tasks", "Node.js"],
  ["Rule-based agents", "Edit, Task and Communication scores", "Node.js"],
  ["ANN service", "Validates input, scales it, runs the network", "Flask, TensorFlow"],
  ["Risk Agent", "Calls the service, fuses scores, applies fallback", "Node.js, axios"],
  ["Decision Agent", "Allow, Nudge or Alert with reasons", "Node.js"],
  ["Prediction store", "Persists probability, scores and feedback", "MongoDB"],
  ["Drift monitor", "Compares live inputs with training data", "Python, SciPy"],
])}
${sub("Data Flow")}
<p>Six numbers travel to the service as JSON and one probability returns. No names, identifiers or free text are sent. The backend stores the probability and the six features with the prediction, and the service appends the features (without identifiers) to a local log used for drift checks unless the caller sets <code>log</code> to false.</p>
${sub("Control Flow")}
<p>The Risk Agent waits at most three seconds. If the call fails or times out, it computes a rule-based estimate from the same six features and marks the source as <code>fallback-heuristic</code>; the written reasons then say so. This keeps the pipeline available when the service is down, at the cost of silently different behaviour unless the label is read.</p>
${sub("ML Service Layer")}
<p>The service loads <code>model.h5</code>, <code>scaler.pkl</code> and <code>feature_names.json</code> once at start-up and refuses to start if they are missing. It exposes health, prediction, model information and drift endpoints (${ref("tbl:api")}).</p>
${sub("Storage and Interface")}
<p>Each prediction record keeps <code>annRiskProbability</code> and <code>featuresUsed</code>, which makes later audit and retraining possible. The React front end shows the value as the \u201cANN risk\u201d bar and in the written reasons, and a public estimator on the landing page calls the same endpoint.</p>
${sub("Deployment Architecture")}
<p>All services run locally: the service on port 5001, the API on 5000 and the Vite development server on 5173, which proxies the browser's <code>/ann</code> requests to the service. No cloud or container deployment exists (Section XIII).</p>`;

const secV = `
${S("Methodology")}
${sub("Data Collection: Simulation")}
<p>No public dataset of team free-riding is available to the authors, so the network is trained on records from a seeded simulator (<code>train_model.py</code>, generator seed 42). ${ref("tbl:sim")} lists the distributions. A latent effort score combines the features, noise is added, and the label is derived from the result:</p>
${eq("latent = 0.30 (tasks/100) + 0.20 tanh(edits/20) + 0.15 tanh(messages/15) + 0.15 tanh(commits/10) + 0.15 (deadline/100) + 0.05 (days/7)", 4)}
${eq("risk = 1 \u2212 clip(latent + \u03b5, 0, 1),&nbsp; \u03b5 ~ N(0, 0.07\u00b2),&nbsp; label = 1 if risk &gt; 0.45", 5)}
${T("tbl:sim", "Simulator distributions (4,000 records)", ["Feature", "Distribution", "Clipping"], [
  ["Tasks completed (%)", "Normal(65, 25)", "0 to 100"],
  ["Document edits", "Gamma(shape 2, scale 8)", "at least 0"],
  ["Messages sent", "Gamma(shape 2, scale 5)", "at least 0"],
  ["Commits", "Gamma(shape 1.8, scale 4)", "at least 0"],
  ["Deadline adherence (%)", "Normal(70, 22)", "0 to 100"],
  ["Active days", "Normal(4.5, 2.2)", "0 to 7"],
])}
<p>The positive (at-risk) rate is ${pc(ds.positive_rate)}. The label depends on the features through a known formula, so the dataset measures how well a model recovers that formula under noise. It does not measure how well activity predicts real free-riding.</p>
${sub("Data Preprocessing")}
<p>The data is split 80/20 with stratification (<code>random_state</code> 42) into ${nl(ds.train)} training and ${nl(ds.test)} test records. A <code>StandardScaler</code> is fitted on the training rows only and saved with the model, so inference applies identical scaling.</p>
${sub("Model Selection")}
<p>A small multilayer perceptron was chosen because the input is six dense numeric features, the target is a probability, and the model must load and answer quickly. ReLU hidden layers are the usual default ${cite("nair")}; the output uses a sigmoid so that it can be read as a probability. Dropout of 0.2 after the first hidden layer regularises training ${cite("srivastava")}. At 257 parameters the model is small relative to 3,200 training rows. The design was not tuned by search: layer sizes were fixed in advance, which is a limitation noted in Section XV.</p>
${F("fig:network", "Architecture of the free-riding ANN: six standardized inputs, two ReLU layers and a sigmoid output.", { src: "a1.png", w: "92%" }, { wide: true })}
${sub("Model Training")}
${T("tbl:config", "Network and training configuration", ["Item", "Value"], [
  ["Layers", "Input(6), Dense(16, ReLU), Dropout(0.2), Dense(8, ReLU), Dense(1, sigmoid)"],
  ["Parameters", `${rep.parameters} (112, 136 and 9 per layer)`],
  ["Initialisation", "Keras default (Glorot uniform) " + cite("glorot")],
  ["Optimiser, loss", "Adam (library default settings), binary cross-entropy"],
  ["Batch size, epochs", "32, maximum 100"],
  ["Validation", "15% of training rows"],
  ["Early stopping", "Monitor validation loss, patience 8, restore best weights"],
  ["Stopped at", `${metrics.epochs_trained} epochs (deployed run)`],
  ["Random seed", "Not set for TensorFlow in the training script"],
])}
<p>The training script does not fix TensorFlow's random seed, so each run produces slightly different weights. This is why the report includes a five-seed study (Section IX-F) in addition to the stored result.</p>
${sub("Model Evaluation")}
<p>Accuracy, precision, recall, F1 and ROC-AUC ${cite("fawcett")} are computed on the held-out test set at the 0.5 threshold, with a confusion matrix. Additional analyses are: a threshold sweep; calibration by ten equal-width bins, expected calibration error (ECE) and the Brier score ${cite("brier")}; permutation importance as the drop in AUC when one feature is shuffled ${cite("altmann")}; one-feature sensitivity curves with the others at their training medians; robustness to Gaussian noise added to standardized inputs; and five retrainings with seeds 0 to 4.</p>
${sub("Baselines and Ablation")}
<p>The network is compared with the four classical models from the project's comparison pipeline, with a majority-class predictor, and with the labelling formula applied directly. The fused-score ablation recomputes each demonstration student's contribution without the network term, re-weighting the remaining weights (0.30, 0.35, 0.15) to sum to one, and compares decisions.</p>
${sub("Decision Logic and Fallback")}
<p>The fallback uses Eq. (4) with the six features (risk = 1 \u2212 latent). Because this is the same expression that generated the labels, it is a strong stand-in in the simulated setting, a point taken up in Section XIV.</p>
${F("fig:pipeline", "Training and artifact pipeline of the ANN.", { src: "a3.png", w: "96%" }, { wide: true })}`;

const secVI = `
${S("Implementation")}
${sub("Technology Stack")}
${T("tbl:stack", "Technologies used by the ANN component", ["Layer", "Technology", "Version or note"], [
  ["Neural network", "TensorFlow (Keras), CPU build", exp.environment.tensorflow],
  ["Preprocessing, baselines", "scikit-learn, NumPy, pandas", `${exp.environment.scikit_learn}, ${exp.environment.numpy}, 2.2.2`],
  ["Serving", "Flask, flask-cors, joblib", "3.0.3, 4.0.1, 1.4.2"],
  ["Language", "Python", exp.environment.python],
  ["Backend caller", "Node.js, Express, axios", "Risk Agent in <code>riskAgent.js</code>"],
  ["Front end", "React, Vite", "Landing estimator and portal screens"],
  ["Plots", "Matplotlib, SciPy", "3.9.2, 1.13.1"],
])}
${sub("Source Files")}
${T("tbl:files", "Files that implement or evaluate the ANN", ["File", "Purpose"], [
  ["<code>ann-service/train_model.py</code>", "Simulate data, train, evaluate, save model, scaler, metrics"],
  ["<code>ann-service/predict_service.py</code>", "Flask API: health, predict, model info, drift"],
  ["<code>backend/src/agents/riskAgent.js</code>", "Call the service, fusion formula, fallback"],
  ["<code>backend/src/agents/orchestrator.js</code>", "Build the six features from activity and tasks"],
  ["<code>ann-service/aml_pipeline.py</code>", "Compare with four classical models, versioned registry"],
  ["<code>ann-service/drift_monitor.py</code>", "KS test and PSI of live inputs"],
  ["<code>ann-service/retrain.py</code>", "Append faculty-labelled rows, retrain"],
  ["<code>ann-service/ann_experiments.py</code>", "Experiments in this report"],
  ["<code>ann-service/ann_service_checks.py</code>", "Service checks, latency, ablation"],
  ["<code>ann-service/ann_latency.py</code>", "In-process latency"],
])}
${sub("Service API")}
${T("tbl:api", "ANN service endpoints", ["Method and path", "Behaviour"], [
  ["GET /health", "Reports whether the model is loaded"],
  ["POST /predict", "Six features in, probability out; 400 on missing or non-numeric input; optional <code>log</code> flag"],
  ["GET /model/info", "Metrics, five-model comparison, importance, registry"],
  ["GET /model/drift", "KS and PSI per feature once at least 10 requests are logged"],
])}
${sub("Backend Integration")}
<p>The Risk Agent posts the six features with a three-second timeout. On success it records the probability with source <code>ann</code>; on any failure it computes the fallback and records <code>fallback-heuristic</code>. The orchestrator appends a written reason of the form \u201cANN model estimates 97.0% risk probability (ann)\u201d. This text appeared in the running application (Section XI), and fallback values were observed during development whenever the service had not yet started.</p>
${sub("Implementation Notes")}
<ul>
<li>The model is saved in the legacy HDF5 format; Keras prints a deprecation warning when saving.</li>
<li>Flask runs its development server, which warns that it is not for production use.</li>
<li>The model version is the file's modification time, not a content hash.</li>
</ul>`;

const secVII = `
${S("Workflow and System Operation")}
${sub("Training Workflow")}
<ol>
<li>Simulate or load <code>dataset.csv</code> (4,000 rows).</li>
<li>Split 80/20 with stratification; fit the scaler on training rows.</li>
<li>Train with early stopping; evaluate on the test split.</li>
<li>Save <code>model.h5</code>, <code>scaler.pkl</code>, <code>metrics.json</code>, <code>feature_names.json</code>.</li>
<li>Optionally run <code>aml_pipeline.py</code> to compare with classical models.</li>
</ol>
${sub("Inference Workflow")}
<ol>
<li>The service loads artifacts at start-up (about 25 s on the development machine, observed).</li>
<li>The backend sends six features for one student.</li>
<li>The service orders the features, scales them, runs the network and returns <i>p</i>.</li>
<li>The Risk Agent fuses <i>p</i> with agent scores and the Decision Agent selects the action.</li>
<li>The record is stored and displayed.</li>
</ol>
${sub("Feedback and Retraining Workflow")}
<p>Faculty mark a prediction correct or incorrect. The export endpoint turns each review into a labelled row (a confirmed prediction keeps its label; a rejected one flips it), and <code>retrain.py</code> appends the rows and retrains. The export and the label flip were exercised during development; <code>retrain.py</code> itself was <b>not executed</b> for this report.</p>`;

const secVIII = `
${S("Evaluation Design")}
${sub("Objectives")}
<p>The evaluation asks six questions: does the stored result reproduce; how well does the network separate classes; are its probabilities calibrated; how stable is training; is the network better than simpler alternatives; and how does the running service behave.</p>
${sub("Dataset")}
${T("tbl:dataset", "Simulated dataset by class (mean of each feature)", ["Feature", "Normal", "At risk", "Std. dev. (all)"], featKeys.map((k) => [FEAT[k][0], f2(ds.features[k].mean_normal), f2(ds.features[k].mean_at_risk), f2(ds.features[k].std)]), { align: ["", "n", "n", "n"] })}
<p>The dataset has ${nl(ds.rows)} rows (${nl(ds.train)} train, ${nl(ds.test)} test) with an at-risk rate of ${pc(ds.test_positive_rate, 0)} on the test set, so a majority-class predictor scores ${pc(ds.majority_class_accuracy_test, 0)} accuracy.</p>
${sub("Experimental Setup")}
<p>Experiments ran on ${exp.environment.platform} with an ${exp.environment.processor} processor, Python ${exp.environment.python}, TensorFlow ${exp.environment.tensorflow} (CPU) and scikit-learn ${exp.environment.scikit_learn}. The deployed model and scaler were loaded read-only. Retraining for the seed study ran in memory and did not modify any deployed file. The machine was shared with other processes, which affects latency figures.</p>
${sub("Baselines")}
<p>Baselines are logistic regression, random forest, gradient boosting and a scikit-learn MLP (from <code>aml_pipeline.py</code>, five-fold cross-validated, tuned by grid search where applicable), a majority-class predictor, and the labelling formula.</p>
${sub("Metrics")}
<p>Accuracy, precision, recall, F1 and ROC-AUC; ECE and Brier score; permutation importance; sensitivity curves; and mean and standard deviation across seeds. Latency is reported as median and 95th percentile.</p>
${sub("Test Cases")}
<p>Twelve scripted service checks are listed in Section X. The tests were written for this report; no earlier executed test suite for the ANN exists.</p>
${sub("Limits of the Design")}
<p>All comparisons use one data split and one simulator. The network's cross-validated score was not computed, so network and baselines are compared on test metrics only.</p>`;

const thrRows = exp.threshold_sweep.rows.filter((r) => [0.3, 0.4, 0.5, 0.6, 0.7].includes(r.threshold));
const secIX = `
${S("Results and Analysis")}
${sub("Held-Out Performance")}
<p>The stored network scores accuracy ${f3(metrics.accuracy)}, precision ${f3(metrics.precision)}, recall ${f3(metrics.recall)}, F1 ${f3(metrics.f1_score)} and ROC-AUC ${f3(metrics.roc_auc)} on ${metrics.n_test} test records. Reloading the model and scaler and scoring the same split reproduces every value exactly (maximum difference ${rep.max_abs_difference}). The confusion matrix (${ref("fig:eval")}a) has ${tn} true negatives, ${fp} false positives, ${fn} false negatives and ${tp} true positives. The network therefore catches ${pc(tp / (tp + fn), 0)} of at-risk records and flags ${pc(fp / (fp + tn), 0)} of normal ones. The ${pc(ds.majority_class_accuracy_test, 0)} majority-class accuracy is the floor that accuracy must beat.</p>
${F("fig:eval", "Held-out evaluation (n = 800): (a) confusion matrix, (b) ROC curve with the 0.5 operating point, (c) threshold sweep.", [{ src: "cm.png", w: "26%" }, { src: "roc.png", w: "30%" }, { src: "threshold.png", w: "32%" }], { wide: true })}
${sub("Threshold and Operating Point")}
<p>Recall rises and precision falls as the threshold falls (${ref("tbl:thr")}). F1 is highest at 0.5 (${f3(exp.threshold_sweep.best_f1.f1)}), so the default threshold is also the F1-optimal one on this data. If missing a free-rider is judged worse than a false flag, a lower threshold such as 0.3 raises recall to ${pc(thrRows[0].recall, 0)} at a precision of ${pc(thrRows[0].precision, 0)}. In deployment the probability is fused rather than thresholded, so this trade-off applies mainly to the public estimator bands.</p>
${T("tbl:thr", "Threshold sweep on the test set", ["Threshold", "Precision", "Recall", "F1", "Accuracy"], thrRows.map((r) => [f2(r.threshold), f3(r.precision), f3(r.recall), f3(r.f1), f3(r.accuracy)]), { align: ["n", "n", "n", "n", "n"] })}
${sub("Calibration")}
<p>The expected calibration error is ${f3(cal.ece)} and the Brier score ${f3(cal.brier)}. The reliability curve (${ref("fig:diag")}a) follows the diagonal at the extremes (${pc(cal.bins[0].mean_predicted, 0)} predicted against ${pc(cal.bins[0].observed_rate, 0)} observed in the lowest bin; ${pc(cal.bins[9].mean_predicted, 0)} against ${pc(cal.bins[9].observed_rate, 0)} in the highest) but over-states risk in the middle: the bins predicted at ${pc(cal.bins[2].mean_predicted, 0)} to ${pc(cal.bins[4].mean_predicted, 0)} had observed rates of ${pc(cal.bins[2].observed_rate, 0)} to ${pc(cal.bins[4].observed_rate, 0)}. Calibration was not corrected; calibration methods for networks are discussed by Guo et al. ${cite("guo")}.</p>
${sub("Comparison with Baselines and the Labelling Rule")}
${T("tbl:baseline", "Test performance of the network and baselines (same split)", ["Model", "CV F1", "Test acc.", "Test F1", "Test AUC"], [
  ...["LogisticRegression", "RandomForest", "GradientBoosting", "MLP (sklearn)"].map((n) => [n, f3(aml.models[n].cv_f1_mean), f3(aml.models[n].test.accuracy), f3(aml.models[n].test.f1), f3(aml.models[n].test.roc_auc)]),
  ["ANN (Keras, deployed)", "not computed", f3(metrics.accuracy), f3(metrics.f1_score), f3(metrics.roc_auc)],
  ["Labelling formula (Eq. 4)", "n/a", f3(ceil["accuracy_at_0.45"]), f3(ceil["f1_at_0.45"]), f3(ceil.roc_auc)],
  ["Majority class", "n/a", f3(ds.majority_class_accuracy_test), "n/a", "0.500"],
], { align: ["", "n", "n", "n", "n"] })}
<p>The network's AUC (${f3(metrics.roc_auc)}) is above the four classical models (${f3(aml.models.RandomForest.test.roc_auc)} to ${f3(aml.models.LogisticRegression.test.roc_auc)}), but by margins of about 0.004 to 0.021. More importantly, the labelling formula applied directly reaches AUC ${f3(ceil.roc_auc)}, essentially identical to the network. Since the labels come from that formula plus noise, the noise sets a ceiling and the network has reached it. The comparison supports the conclusion that the network learned the simulator's rule; it does not show an advantage on real data, where the true rule is unknown. This is consistent with reports that simple models are competitive on small tabular data ${cite("shwartz", "grinsztajn")}.</p>
${sub("Training Behaviour and Seed Variance")}
<p>In the re-run with seed 0 (${ref("fig:train")}) validation loss tracks training loss closely, ending at ${f3(exp.training_history_seed0.final_val_loss)} against ${f3(exp.training_history_seed0.final_train_loss)}, so overfitting is small. Early stopping ended the five runs after ${A.epochs.min} to ${A.epochs.max} epochs (mean ${A.epochs.mean.toFixed(0)}), a wide range caused by a flat validation curve. Test AUC across the five seeds is ${f4(A.roc_auc.mean)} \u00b1 ${f4(A.roc_auc.std)} (range ${f4(A.roc_auc.min)} to ${f4(A.roc_auc.max)}); F1 is ${f3(A.f1.mean)} \u00b1 ${f3(A.f1.std)} and accuracy ${f3(A.accuracy.mean)} \u00b1 ${f3(A.accuracy.std)}. The deployed model's AUC (${f4(metrics.roc_auc)}) is slightly above the best of the five re-runs, which is within what random initialisation can produce. Differences between seeds are smaller than the gap to the weakest baseline but comparable to the gap to the best baselines, so only a small and unproven advantage over logistic regression is supported.</p>
${T("tbl:seeds", "Retraining under five seeds (in memory, test set)", ["Seed", "Epochs", "Accuracy", "F1", "AUC"], [
  ...exp.seed_variance.runs.map((r) => [r.seed, r.epochs, f3(r.accuracy), f3(r.f1), f4(r.roc_auc)]),
  [`<b>Mean \u00b1 SD</b>`, `${A.epochs.mean.toFixed(0)} \u00b1 ${A.epochs.std.toFixed(0)}`, `${f3(A.accuracy.mean)} \u00b1 ${f3(A.accuracy.std)}`, `${f3(A.f1.mean)} \u00b1 ${f3(A.f1.std)}`, `${f4(A.roc_auc.mean)} \u00b1 ${f4(A.roc_auc.std)}`],
], { align: ["n", "n", "n", "n", "n"] })}
${F("fig:train", "Training behaviour (re-run, seed 0) and variation of test scores across five seeds.", [{ src: "training.png", w: "62%" }, { src: "seeds.png", w: "29%" }], { wide: true })}
${sub("Feature Importance")}
<p>Shuffling task completion lowers AUC by ${f3(imp.tasks_completed_pct.mean)}, document edits by ${f3(imp.doc_edits.mean)}, commits by ${f3(imp.commits.mean)}, messages by ${f3(imp.messages_sent.mean)}, deadline adherence by ${f3(imp.deadline_adherence_pct.mean)} and active days by ${f3(imp.active_days_last7.mean)} (${ref("fig:diag")}b). The ranking matches the project's scikit-learn MLP (task ${f3(aml.feature_importance.tasks_completed_pct)}, edits ${f3(aml.feature_importance.doc_edits)}), and follows the simulator's weights: task completion has the largest weight (0.30) and active days the smallest (0.05). Importance therefore reflects the simulator, and says nothing about real behaviour.</p>
${T("tbl:imp", "Permutation importance of the network (20 repeats)", ["Feature", "AUC drop (mean)", "SD"], featKeys.slice().sort((a, b) => imp[b].mean - imp[a].mean).map((k) => [FEAT[k][0], f3(imp[k].mean), f3(imp[k].std)]), { align: ["", "n", "n"] })}
${sub("Sensitivity")}
<p>Varying one feature at a time from its 5th to 95th percentile, with the others at their training medians (${ref("fig:sens")}), the predicted risk falls monotonically for all six features (${ref("tbl:sens")}). The response is steepest for task completion (${f2(sens.tasks_completed_pct.p_at_5th)} to ${f2(sens.tasks_completed_pct.p_at_95th)}) and shallowest for active days (${f2(sens.active_days_last7.p_at_5th)} to ${f2(sens.active_days_last7.p_at_95th)}). This is the expected direction: more effort never raises the estimated risk.</p>
${T("tbl:sens", "Predicted risk at the 5th and 95th percentile of each feature", ["Feature", "p at 5th", "p at 95th", "Non-increasing"], featKeys.map((k) => [FEAT[k][0], f2(sens[k].p_at_5th), f2(sens[k].p_at_95th), sens[k].non_increasing ? "Yes" : "No"]), { align: ["", "n", "n", ""] })}
${F("fig:sens", "One-feature sensitivity of the ANN (others at training medians).", { src: "sensitivity.png", w: "76%" }, { wide: true })}
${sub("Robustness to Noise")}
<p>Adding Gaussian noise to standardized test inputs degrades discrimination gradually (${ref("fig:diag")}c): AUC is ${f3(exp.noise_robustness[1].roc_auc)} at 0.1 SD, ${f3(exp.noise_robustness[2].roc_auc)} at 0.25 SD, ${f3(exp.noise_robustness[3].roc_auc)} at 0.5 SD and ${f3(exp.noise_robustness[4].roc_auc)} at 1.0 SD, against ${f3(exp.noise_robustness[0].roc_auc)} without noise. Small measurement error (for example a miscounted commit) therefore changes little, while large errors cost accuracy.</p>
${F("fig:diag", "Diagnostics: (a) reliability diagram, (b) permutation importance, (c) robustness to input noise.", [{ src: "calibration.png", w: "28%" }, { src: "importance.png", w: "32%" }, { src: "noise.png", w: "30%" }], { wide: true })}
${sub("Latency")}
<p>${ref("tbl:lat")} shows the cost of inference. A direct model call takes about ${lat["model(x, training=False), 1 sample"].median_ms.toFixed(0)} ms, whereas Keras <code>predict</code> on one sample takes about ${lat["model.predict, 1 sample"].median_ms.toFixed(0)} ms because of its per-call setup. The HTTP service, which uses <code>predict</code>, answered in ${Math.round(chk.latency_http.median_ms)} ms median and ${Math.round(chk.latency_http.p95_ms)} ms at the 95th percentile. These are well inside the 3 s client timeout, but most of the time is framework overhead rather than computation. An earlier measurement taken while other processes were running gave ${exp.latency_in_process.predict_single_median_ms.toFixed(0)} ms for <code>predict</code> and ${exp.latency_in_process.call_single_median_ms.toFixed(1)} ms for a direct call, so absolute values vary on this shared machine.</p>
${T("tbl:lat", "Inference latency on the development machine", ["Measurement", "Median (ms)", "p95 (ms)"], [
  ["model.predict, 1 sample (in process)", lat["model.predict, 1 sample"].median_ms.toFixed(0), lat["model.predict, 1 sample"].p95_ms.toFixed(0)],
  ["model(x), 1 sample (in process)", lat["model(x, training=False), 1 sample"].median_ms.toFixed(1), lat["model(x, training=False), 1 sample"].p95_ms.toFixed(1)],
  ["model.predict, 800 samples", lat["model.predict, 800 samples"].median_ms.toFixed(0), lat["model.predict, 800 samples"].p95_ms.toFixed(0)],
  ["POST /predict over HTTP (100 requests)", chk.latency_http.median_ms.toFixed(0), chk.latency_http.p95_ms.toFixed(0)],
], { align: ["", "n", "n"] })}
${sub("Effect on the Fused Decision (Ablation)")}
<p>For the nine demonstration students, removing the network term and re-weighting the rest shifts the contribution score by ${abl.mean_abs_shift_points.toFixed(1)} points on average (maximum ${abl.max_abs_shift_points}), and changes the risk level for ${abl.changed_level} of ${abl.rows.length} (${ref("tbl:abl")}). The change is largest where the network disagrees with the rule-based agents: the student with a ${pc(abl.rows.find((r) => r.student === "Meena").ann_probability, 0)} network probability moves from a Nudge-level score to an Alert. With nine simulated students this shows how the term works, not how often it matters.</p>
${T("tbl:abl", "Contribution score with and without the network (demonstration students)", ["Student", "ANN p", "With ANN", "Without", "Level with", "Level without"], abl.rows.map((r) => [r.student, f3(r.ann_probability), r.contribution_with_ann, r.contribution_without_ann, r.level_with, r.level_without]), { align: ["", "n", "n", "n", "", ""] })}`;

const statusLabel = (r) => (r.id === "S6" ? "Gap found" : r.status);
const secX = `
${S("Testing and Validation")}
${sub("Scope")}
<p>No automated unit-test suite for the ANN existed before this study. The evidence in this section comes from scripts written for the report: the metric reproduction (Section IX-A) and twelve service checks run against the live service on ${chk.ran_at.slice(0, 10)}. Unit tests of the training code, concurrency tests, authentication tests and load tests were not performed.</p>
${sub("Model and Artifact Testing")}
<p>Reloading <code>model.h5</code> and <code>scaler.pkl</code> and scoring the stored test split reproduced accuracy, precision, recall, F1 and ROC-AUC with a maximum absolute difference of ${rep.max_abs_difference}, confirming that the deployed artifacts match the stored metrics and that the split is regenerable from <code>random_state</code> 42.</p>
${sub("API Testing")}
<p>${ref("tbl:tests")} lists the twelve checks, their expected results and what was observed.</p>
${T("tbl:tests", "Service checks executed against the running ANN service", ["ID", "Component", "Test case", "Expected result", "Actual result", "Status"], chk.results.map((r) => [r.id, "Service", r.case, r.expected, r.actual.replace(/</g, "&lt;"), statusLabel(r)]), { wide: true })}
<p class="wide">All twelve checks completed as expected. Check S6 is a documentation test: the service accepts inputs far outside the valid range (for example a negative task percentage or a billion commits) and returns a probability, so range validation is missing. It is labelled a gap rather than a pass.</p>
${sub("Integration Testing")}
<p>The end-to-end path (backend to service to stored prediction to screen) was observed in the running application: the stored probability and the \u201cANN\u201d label appeared on the student and faculty screens (Section XI), and the ablation table in ${ref("tbl:abl")} was built from records produced by that path. The broader API script for the platform was not part of this study and its results are not reported.</p>
${sub("Edge Cases and Error Handling")}
<p>Missing and non-numeric features return HTTP 400 with the expected feature names; an empty body returns 400. Out-of-range values are accepted (S6). When the service is down the backend uses the fallback; this behaviour was seen during development but was not re-tested here by stopping the service.</p>`;

const secXI = `
${S("User Interface and System Views")}
<p>The ANN output appears on four screens. In each, the value is shown alongside rule-based scores and written reasons rather than alone.</p>
${sub("Student AI Feedback")}
<p>Purpose: show a student how the score was reached. User: student. The screen lists the edit, task and communication scores and an \u201cANN risk\u201d bar (the probability \u00d7 100), the written reasons including \u201cANN model estimates ${shots.studentReasons.find((s) => s.startsWith("ANN")).match(/[\d.]+%/)[0]} risk probability (ann)\u201d, and a suggested next step. The values shown are those of a demonstration student (${ref("fig:ui1")}).</p>
${F("fig:ui1", "Student AI feedback page for a demonstration student. Simulated data.", { src: "ui-feedback.png", w: "74%" }, { wide: true })}
${sub("Faculty Student Detail")}
<p>Purpose: let faculty inspect and review a prediction. User: faculty. The agent breakdown shows the same four bars, the contribution ring, the written reasons, a trend chart, and buttons to mark the prediction correct or incorrect (${ref("fig:ui1b")}). These reviews are the source of retraining labels.</p>
${F("fig:ui1b", "Faculty student detail for the same student (upper part of the page). Simulated data.", { src: "ui-detail.png", w: "74%" }, { wide: true })}
${sub("Faculty Analytics")}
<p>Purpose: compare the deployed network with the other models and show drift status. The panel lists test ROC-AUC for five models with the network highlighted (${ref("fig:ui2")}). The drift line reports that live inputs differ from the training data for all six features. This reflects the demonstration data (seeded totals and a log that accumulates across sessions), not real drift.</p>
${F("fig:ui2", "Faculty analytics: model comparison and data drift status.", { src: "ui-analytics.png", w: "78%" }, { wide: true })}
${sub("Public Estimator")}
<p>Purpose: let a visitor try the network. User: any visitor. The form takes six numbers with validation, calls the service with logging disabled, and shows the probability, a band and a meter with marks at 30 and 70 (${ref("fig:ui3")}). A very high probability (here 0.9994) is displayed as 100%, so the rounded display hides the difference between 99.9% and 100%.</p>
${F("fig:ui3", "Public estimator on the landing page, low-activity example.", { src: "ui-estimator.png", w: "62%" }, { wide: true })}`;

const secXII = `
${S("Security, Privacy and Safety")}
${T("tbl:sec", "Security and privacy status of the ANN component", ["Area", "Current state", "Assessment"], [
  ["Data sent", "Six numbers, no identifiers or free text", "Good"],
  ["Prediction log", "Features appended to a local file unless log is false; no identifiers", "Accumulates across sessions; no rotation"],
  ["Public estimator", "Sends log false; nothing stored", "Good"],
  ["Service authentication", "None; any caller that can reach port 5001 can predict or read model information", "Gap"],
  ["Cross-origin access", "Open (flask-cors defaults)", "Gap for deployment"],
  ["Input validation", "Types checked, ranges not checked", "Gap (check S6)"],
  ["Model artifacts", "Local files, version from modification time, no integrity check", "Gap"],
  ["Human oversight", "Output is one input to a decision; faculty can mark it wrong", "Implemented"],
  ["Fairness", "Not evaluated; no demographic data used or tested", "Not done"],
  ["Policy text", "Privacy policy and terms are drafts", TODO("TO BE PROVIDED")],
])}
<p>The network never sees names, emails or register numbers. The main risks are exposure of the unauthenticated service beyond localhost and trust in a probability that comes from a simulated training set. The decision remains advisory: faculty can review each prediction, and the interface states that scores are not grades. Doshi-Velez and Kim stress that interpretability claims need evaluation ${cite("doshi")}; here the written reasons and importance analysis are explanations of the model's behaviour on simulated data, not validated explanations of real effort.</p>`;

const secXIII = `
${S("Deployment and System Requirements")}
${T("tbl:deploy", "Runtime environment (actual) and deployment status", ["Item", "Actual or status"], [
  ["Operating system", exp.environment.platform],
  ["Processor", exp.environment.processor + " (CPU only)"],
  ["Python, TensorFlow", `${exp.environment.python}, ${exp.environment.tensorflow}`],
  ["Ports", "5001 (service), 5000 (API), 5173 (UI)"],
  ["Configuration", "<code>ANN_SERVICE_URL</code> for the backend; default http://127.0.0.1:5001"],
  ["Start-up", "Train once (<code>train_model.py</code>), then <code>predict_service.py</code>; loading takes about 25 s"],
  ["Web server", "Flask development server"],
  ["Hosting and cloud", "None; local only"],
  ["Containers", "Not used"],
  ["Production plan", TODO("TO BE PROVIDED")],
])}
<p>The deployment described here is a development setup. For production the service would need a production WSGI server, authentication, input validation, model versioning by content hash, monitoring and a restart policy. These are future work, not present features.</p>`;

const secXIV = `
${S("Discussion")}
<p><b>Main finding.</b> The network is faithful to its training data and nothing more: it reproduces exactly, trains stably across seeds, behaves monotonically and tolerates small noise, and its AUC equals that of the formula that produced the labels. In this setting its performance is bounded by label noise, so the numbers cannot rank it against alternatives that also reach the ceiling.</p>
<p><b>What the network adds.</b> Against the four classical models its margin is small (about 0.004 to 0.005 AUC over logistic regression and the scikit-learn MLP), and the labelling formula, which is also the system's fallback, matches it. In the simulated world the network adds no measurable value over the rule it imitates. Its value could appear only if real effort relates to activity in ways the rule does not capture, which requires real labelled data. The ablation shows that the 20% weight does change decisions for some students, but a rule-based term would change them too.</p>
<p><b>Trade-offs.</b> A neural model was chosen to learn non-linear combinations without hand-written weights, at the cost of a service, a model file, a slower call path and weaker transparency than a formula. That is consistent with the literature that favours simple or tree-based models for small tabular problems ${cite("shwartz", "grinsztajn")}. The design is still reasonable as a platform: a learned estimator can be retrained on real feedback without changing the pipeline.</p>
<p><b>Calibration.</b> The error of ${f3(cal.ece)} is modest but concentrated in the middle range, where the network over-states risk. Because the fused score uses the probability linearly, this inflates risk slightly for mid-range students.</p>
<p><b>Engineering observations.</b> Request time is dominated by Keras call overhead; calling the model directly would cut single-sample time by roughly an order of magnitude. The service's lack of range validation lets nonsensical inputs return confident answers. These are cheap to fix and matter more than model changes at this stage. They illustrate the point that a deployed model carries maintenance and operational costs beyond training ${cite("sculley")}.</p>
<p><b>Comparison with existing approaches.</b> Peer assessment gives a late, subjective signal; the network gives an early, objective but unvalidated one. The two are complementary, and the system keeps faculty review in the loop.</p>`;

const secXV = `
${S("Limitations")}
<ul>
<li><b>Simulated data.</b> Training data and labels come from a formula; no real students or real free-riding labels were used. Every performance number is conditional on that.</li>
<li><b>Ceiling effect.</b> Performance equals the labelling formula's, so the evaluation cannot discriminate between good models.</li>
<li><b>Single split and simulator.</b> One split, one simulator and five seeds; no cross-validation for the network, so differences from baselines are tentative.</li>
<li><b>Aggregate window.</b> Seven-day totals hide timing; commit counts do not capture quality, and recorded active minutes are not used.</li>
<li><b>Calibration.</b> Probabilities are not recalibrated and over-state mid-range risk.</li>
<li><b>Service gaps.</b> No authentication, no range validation, development server, slow call path, and a drift log that mixes sessions.</li>
<li><b>Reproducibility.</b> The training script sets no TensorFlow seed, so retraining produces different weights; stored metrics are reproducible only for the saved model.</li>
<li><b>Untested paths.</b> Fallback under outage, concurrency, load, retraining execution, fairness and any real deployment.</li>
<li><b>Demonstration scale.</b> The ablation uses nine simulated students.</li>
</ul>`;

const secXVI = `
${S("Future Work")}
<ol>
<li><b>Immediate.</b> Add range validation and authentication to the service; call the model directly instead of <code>predict</code>; fix the random seed and save a content hash with the model; rotate the drift log.</li>
<li><b>Technical.</b> Add automated tests for the service and training code; run the stop-the-service fallback test; replace the development server.</li>
<li><b>AI and ML.</b> Collect real labels (instructor review, time-stamped proof of work); evaluate with cross-validation and temporal splits; recalibrate (for example temperature scaling ${cite("guo")}); compare with tree ensembles on real data ${cite("grinsztajn")}.</li>
<li><b>Scalability.</b> Batch endpoint; model loading shared across workers; container image.</li>
<li><b>Security.</b> Service-to-service credentials, restricted origins, signed artifacts.</li>
<li><b>Research.</b> Study fairness across groups, compare alert thresholds with faculty judgement, and measure whether early alerts improve outcomes.</li>
<li><b>Production.</b> Staged rollout as decision support only, with monitoring of drift and faculty correction rate.</li>
</ol>`;

const secXVII = `
${S("Conclusion")}
<p>The ANN component estimates free-riding risk from seven days of activity using a 257-parameter feed-forward network served by a Flask microservice and fused into an explainable Allow, Nudge or Alert decision, with a rule-based fallback. On simulated data it reaches accuracy ${f3(metrics.accuracy)} and ROC-AUC ${f3(metrics.roc_auc)}, reproduces exactly from stored artifacts, varies by only \u00b1${f4(A.roc_auc.std)} AUC across retrainings, behaves monotonically and tolerates small noise. Its performance equals that of the labelling formula and is within about 0.02 AUC of classical baselines, so the evidence supports a faithful and well-integrated implementation, not a demonstration of real-world detection. Gaps in validation, authentication, calibration and latency are identified with clear fixes. The next step is real labelled data; until then the output should be used only as one advisory input reviewed by faculty.</p>
<h2>Acknowledgment</h2>
<p>The authors thank ${TODO("FACULTY GUIDE")}, the ${TODO("DEPARTMENT")} and ${TODO("INSTITUTION")} for guidance and facilities. ${TODO("OTHER ACKNOWLEDGEMENTS, IF ANY")}</p>`;

const appendices = `
<h2>Appendix A. Reproducing the Results</h2>
<p>From the project root, with the Python environment of <code>ann-service</code> activated:</p>
<ul>
<li><code>python train_model.py</code>: simulate, train, save artifacts and metrics (do not rerun if the stored model must be preserved).</li>
<li><code>python ann_experiments.py</code>: all analyses in Section IX; writes <code>report/ann/ann_experiments.json</code> and figures.</li>
<li><code>python predict_service.py</code> then <code>python ann_service_checks.py</code>: service checks, HTTP latency and ablation (needs the backend for the ablation).</li>
<li><code>python ann_latency.py</code>: in-process latency.</li>
<li><code>node report/ann/build-report.js</code>: regenerate this report from the result files.</li>
</ul>
<h2>Appendix B. Source Reconciliation</h2>
${T("tbl:recon", "Differences between project notes and implementation, and how they were handled", ["Topic", "Project note", "Implementation (used here)"], [
  ["Input features", "Meaningful commits and activity time", "Commit counts and active days; recorded active minutes are unused by the network"],
  ["Label source", "Instructor or time-stamped proof of work", "Simulator labels only"],
  ["Scope of AI", "LLM and retrieval layers mentioned for the wider course", "None in the ANN component"],
  ["Network comparison", "Deployed ANN listed with classical models", "ANN has test metrics only; classical models also have cross-validated scores"],
  ["Training seed", "Not specified", "No TensorFlow seed in the script; seed study added"],
  ["Drift status", "Interface reports drift", "Reflects a log accumulated across demonstration sessions"],
  ["Probability display", "Percent shown to users", "Rounded (0.9994 shown as 100%)"],
], { wide: true, align: ["", "", ""] })}
<h2>Appendix C. Glossary</h2>
<p><b>ANN</b>: artificial neural network. <b>AUC</b>: area under the ROC curve. <b>ECE</b>: expected calibration error. <b>Free-riding</b>: contributing less than a fair share to team work. <b>Fusion</b>: weighted combination of agent scores and the network probability. <b>PSI</b>: population stability index. <b>KS test</b>: Kolmogorov\u2013Smirnov test. <b>Fallback</b>: rule-based estimate used when the service is unreachable.</p>`;

// ---------- assemble ----------
const body = [secI, secII, secIII, secIV, secV, secVI, secVII, secVIII, secIX, secX, secXI, secXII, secXIII, secXIV, secXV, secXVI, secXVII].join("\n");

// references in order of first citation
cites.forEach((k) => {});
const unused = Object.keys(REFS).filter((k) => !cites.includes(k));
if (unused.length) throw new Error("Uncited references: " + unused.join(", "));
const refsHtml = `<h2 class="wide">References</h2><div class="refs wide">${cites.map((k, i) => `<div>[${i + 1}] ${REFS[k]}</div>`).join("")}</div>`;

let html = `<!doctype html><html><head><meta charset="utf-8"/><title>ANN report</title><link rel="stylesheet" href="style.css"/></head><body>
${cover}
${titleBlock}
<div class="paper">${body}${appendices}</div>
${refsHtml}
</body></html>`;

html = html.replace(/\{\{([^}]+)\}\}/g, (_, k) => {
  if (!labels[k]) throw new Error("Unresolved reference " + k);
  return labels[k];
});

fs.writeFileSync(path.join(DIR, "ann-report.html"), html);
console.log(`HTML written: ${tblNo} tables, ${figNo} figures, ${cites.length} references`);

(async () => {
  const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  const page = await browser.newPage();
  await page.goto("file:///" + path.join(DIR, "ann-report.html").replace(/\\/g, "/"));
  await page.waitForLoadState("networkidle");
  const out = path.join(ROOT, "report", "ANN_Report_Smart_Team_Contribution_Monitoring.pdf");
  await page.pdf({
    path: out,
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;font-family:Times New Roman"><span class="pageNumber"></span></div>',
  });
  await browser.close();

  // Draw a thin border on every page, as in the reference report.
  const { PDFDocument, rgb } = require("pdf-lib");
  const pdf = await PDFDocument.load(fs.readFileSync(out));
  for (const pg of pdf.getPages()) {
    const { width, height } = pg.getSize();
    const m = 17; // points from the page edge (sides and top)
    const bottom = 28; // leaves room for the page number
    pg.drawRectangle({ x: m, y: bottom, width: width - 2 * m, height: height - m - bottom, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
  }
  fs.writeFileSync(out, await pdf.save());
  console.log("PDF written:", out, "pages:", pdf.getPageCount());
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
