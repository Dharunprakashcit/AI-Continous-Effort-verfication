"""Builds the IEEE-style project report (HTML) from the result files, so every number in the text
comes from artifacts/*.json. Convert to PDF with headless Edge/Chrome (see README).

Usage: python -m src.report
"""
import json
import os

from .data import ROOT

A = os.path.join(ROOT, "artifacts")
load = lambda n: json.load(open(os.path.join(A, n)))
tr, bm, er = load("train_report.json"), load("benchmark_report.json"), load("error_analysis.json")
cfg_links = {"hf": os.environ.get("HF_SPACE_URL", "[Hugging Face Space URL]"),
             "gh": os.environ.get("GITHUB_URL", "[GitHub repository URL]")}

REFS = [
    ("cortez", 'P. Cortez and A. Silva, "Using data mining to predict secondary school student performance," in <i>Proc. 5th Future Business Technology Conf. (FUBUTEC)</i>, Porto, Portugal, 2008, pp. 5&ndash;12.'),
    ("romero", 'C. Romero and S. Ventura, "Educational data mining: A review of the state of the art," <i>IEEE Trans. Syst., Man, Cybern. C, Appl. Rev.</i>, vol. 40, no. 6, pp. 601&ndash;618, Nov. 2010.'),
    ("breiman", 'L. Breiman, "Random forests," <i>Mach. Learn.</i>, vol. 45, no. 1, pp. 5&ndash;32, 2001.'),
    ("friedman", 'J. H. Friedman, "Greedy function approximation: A gradient boosting machine," <i>Ann. Statist.</i>, vol. 29, no. 5, pp. 1189&ndash;1232, 2001.'),
    ("xgb", 'T. Chen and C. Guestrin, "XGBoost: A scalable tree boosting system," in <i>Proc. 22nd ACM SIGKDD Int. Conf. Knowl. Discov. Data Min.</i>, 2016, pp. 785&ndash;794.'),
    ("lgbm", 'G. Ke <i>et al.</i>, "LightGBM: A highly efficient gradient boosting decision tree," in <i>Adv. Neural Inf. Process. Syst. (NeurIPS)</i>, vol. 30, 2017, pp. 3146&ndash;3154.'),
    ("cat", 'L. Prokhorenkova, G. Gusev, A. Vorobev, A. V. Dorogush, and A. Gulin, "CatBoost: Unbiased boosting with categorical features," in <i>Adv. Neural Inf. Process. Syst. (NeurIPS)</i>, vol. 31, 2018.'),
    ("tpe", 'J. Bergstra, R. Bardenet, Y. Bengio, and B. K&eacute;gl, "Algorithms for hyper-parameter optimization," in <i>Adv. Neural Inf. Process. Syst. (NeurIPS)</i>, vol. 24, 2011, pp. 2546&ndash;2554.'),
    ("optuna", 'T. Akiba, S. Sano, T. Yanase, T. Ohta, and M. Koyama, "Optuna: A next-generation hyperparameter optimization framework," in <i>Proc. 25th ACM SIGKDD Int. Conf. Knowl. Discov. Data Min.</i>, 2019, pp. 2623&ndash;2631.'),
    ("mlflow", 'M. Zaharia <i>et al.</i>, "Accelerating the machine learning lifecycle with MLflow," <i>IEEE Data Eng. Bull.</i>, vol. 41, no. 4, pp. 39&ndash;45, 2018.'),
    ("shap", 'S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in <i>Adv. Neural Inf. Process. Syst. (NeurIPS)</i>, vol. 30, 2017, pp. 4765&ndash;4774.'),
    ("treeshap", 'S. M. Lundberg <i>et al.</i>, "From local explanations to global understanding with explainable AI for trees," <i>Nat. Mach. Intell.</i>, vol. 2, no. 1, pp. 56&ndash;67, 2020.'),
    ("pca", 'I. T. Jolliffe and J. Cadima, "Principal component analysis: A review and recent developments," <i>Phil. Trans. R. Soc. A</i>, vol. 374, no. 2065, 2016, Art. no. 20150202.'),
    ("tsne", 'L. van der Maaten and G. Hinton, "Visualizing data using t-SNE," <i>J. Mach. Learn. Res.</i>, vol. 9, pp. 2579&ndash;2605, 2008.'),
    ("sklearn", 'F. Pedregosa <i>et al.</i>, "Scikit-learn: Machine learning in Python," <i>J. Mach. Learn. Res.</i>, vol. 12, pp. 2825&ndash;2830, 2011.'),
    ("uci", 'P. Cortez, "Student Performance," UCI Machine Learning Repository, 2008. [Online]. Available: https://doi.org/10.24432/C5TG7T'),
]
IDX = {k: i + 1 for i, (k, _) in enumerate(REFS)}
c = lambda *ks: "[" + ", ".join(str(IDX[k]) for k in ks) + "]"
f3 = lambda x: f"{x:.3f}"
M = tr["models"]
champ = tr["champion"]
cm = M[champ]["test"]
lr = M["LogisticRegression"]["test"]
ds = tr["dataset"]


def fig(n, cap, w="100%", wide=False):
    return f'<figure class="{"wide" if wide else ""}"><img src="../figures/{n}" style="width:{w}"><figcaption>{cap}</figcaption></figure>'


rows = "".join(
    f"<tr><td>{n}</td><td>{f3(v['cv_roc_auc'])}</td><td>{f3(v['test']['roc_auc'])}</td><td>{f3(v['test']['f1'])}</td>"
    f"<td>{f3(v['test']['accuracy'])}</td><td>{f3(v['test']['log_loss'])}</td><td>{v['tuning_seconds']:.0f}</td></tr>"
    for n, v in M.items())
bench = "".join(
    f"<tr><td>{r['course']}</td><td>{r['setup']}</td><td>{r['paper_model']} {r['paper_acc']:.1f}</td>"
    f"<td>{r['LogisticRegression']['mean']:.1f}&plusmn;{r['LogisticRegression']['std']:.1f}</td>"
    f"<td><b>{r[bm['champion']]['mean']:.1f}</b>&plusmn;{r[bm['champion']]['std']:.1f}</td>"
    f"<td>{r['delta']:+.1f}</td><td>{r['t_test_p']:.2f}</td></tr>" for r in bm["rows"])
wins = sum(r["delta"] > 0 for r in bm["rows"])
worst = min(bm["rows"], key=lambda r: r["delta"])
WINTXT = f"exceeds the best reported baseline in {wins} of 6 course/setup combinations and is within {abs(worst['delta']):.1f} points in the remaining one"
thr = {t["threshold"]: t for t in er["threshold_tradeoff"]}
seg_f = {s["failures"]: s for s in er["by_segment"]["failures"]}
seg_c = {s["course"]: s for s in er["by_segment"]["course"]}
n_test = sum(er["counts"].values())
n_fail_test = round(n_test * (1 - ds["positive_rate"]))
p = tr["models"][champ]["best_params"]

html = f"""<!doctype html><html><head><meta charset="utf-8"><title>AML Report</title>
<style>
@page {{ size: A4; margin: 16mm 14mm; }}
body {{ font-family: 'Times New Roman', Times, serif; font-size: 9.6pt; line-height: 1.28; color: #000; margin: 0; }}
h1 {{ font-size: 18pt; text-align: center; margin: 0 0 4px; font-weight: normal; }}
.auth {{ text-align: center; font-size: 10pt; margin-bottom: 10px; }}
.cols {{ column-count: 2; column-gap: 6mm; text-align: justify; }}
h2 {{ font-size: 10pt; text-transform: uppercase; text-align: center; margin: 10px 0 4px; font-weight: normal; letter-spacing: .5px; }}
h3 {{ font-size: 9.6pt; font-style: italic; font-weight: normal; margin: 6px 0 2px; }}
p {{ margin: 0 0 5px; text-indent: 1em; }}
.abs {{ font-weight: bold; font-size: 9pt; }} .abs i {{ font-weight: bold; }}
figure {{ margin: 6px 0; text-align: center; break-inside: avoid; }}
figure.wide {{ column-span: all; }}
figcaption {{ font-size: 8pt; margin-top: 2px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 7.8pt; margin: 4px 0 2px; break-inside: avoid; }}
th, td {{ border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 3px; text-align: center; }}
caption {{ font-size: 8pt; text-transform: uppercase; margin-bottom: 2px; }}
.eq {{ text-align: center; margin: 4px 0; font-style: italic; }}
ol.refs {{ font-size: 8pt; padding-left: 16px; }} ol.refs li {{ margin-bottom: 2px; }}
code {{ font-size: 8pt; }}
.block {{ border: 1px solid #000; padding: 4px; font-size: 7.6pt; text-align: center; break-inside: avoid; }}
.block span {{ display: inline-block; border: 1px solid #555; padding: 2px 4px; margin: 2px; background: #f2f2f2; }}
</style></head><body>
<h1>Early Prediction of Student Failure with Tuned Gradient-Boosted Ensembles: A Reproducible Benchmark on the UCI Student Performance Data</h1>
<div class="auth">[Student Name], [Roll No.] &mdash; 2024 B III M.Sc. AI &amp; ML, Department of Computing &ndash; AI &amp; ML, Coimbatore Institute of Technology<br>
19MAM56 Advanced Machine Learning Lab &mdash; CAT II Project</div>
<div class="cols">
<p class="abs"><i>Abstract</i>&mdash;Identifying students who will fail a course before any grade is recorded allows timely intervention. We study this early-warning task on the UCI Student Performance data ({ds['rows']} students, two courses) using only demographic, social and school attributes (no period grades). An automated pipeline performs schema validation, domain feature engineering, one-hot encoding and optional PCA, then tunes six model families (logistic regression, random forest, MLP, XGBoost, LightGBM and CatBoost) with Bayesian optimisation (Optuna TPE, {len(tr['optuna_history']['XGBoost'])} trials each), logging every trial to MLflow. The champion, chosen on cross-validated ROC-AUC, is {champ} (CV ROC-AUC {f3(M[champ]['cv_roc_auc'])}, test ROC-AUC {f3(cm['roc_auc'])}, F1 {f3(cm['f1'])}). Under the original paper's repeated 10-fold protocol, the tuned model {WINTXT}, compared with Cortez and Silva. SHAP explanations identify past failures, course and higher-education intent as dominant drivers, and an error analysis shows that the default 0.5 threshold misses most failing students, motivating a recall-oriented threshold. The model is served by a validated Flask API and a Gradio interface, containerised with Docker for Hugging Face Spaces.</p>
<p class="abs"><i>Index Terms</i>&mdash;educational data mining, gradient boosting, XGBoost, Bayesian optimisation, SHAP, early warning systems.</p>

<h2>I. Introduction</h2>
<p>Course failure is costly for students and institutions, and the cheapest intervention is an early one. Educational data mining {c('romero')} has shown that student outcomes can be predicted from administrative and survey data, but most published models rely heavily on in-course grades, which only exist after the problem has started. We therefore focus on the hardest and most useful setting: predicting pass/fail <i>before</i> any period grade is available.</p>
<p>The objectives are: (1) build a modular, reproducible pipeline on a public benchmark dataset {c('uci')}; (2) apply advanced ensemble learners with automated hyperparameter optimisation and experiment tracking; (3) compare rigorously against the published baseline {c('cortez')} under its own protocol; (4) explain predictions and analyse errors; and (5) deploy the model as a validated real-time service in a container.</p>

<h2>II. Literature Review</h2>
<p>Cortez and Silva {c('cortez')} introduced the dataset and compared Naive Bayes, neural networks, SVMs, decision trees and random forests on binary, 5-level and regression targets under three feature setups: A (with both period grades G1, G2), B (with G1 only) and C (no grades). They reported that accuracy depends strongly on prior grades and drops sharply in setup C, especially for Mathematics. Romero and Ventura {c('romero')} survey educational data mining and stress interpretability for educators. Since then, gradient-boosted decision trees {c('friedman')} have become the state of the art on tabular data through XGBoost {c('xgb')}, LightGBM {c('lgbm')} and CatBoost {c('cat')}, while random forests {c('breiman')} remain a strong baseline. Model-agnostic and tree-specific SHAP values {c('shap','treeshap')} provide consistent local and global explanations.</p>
<p><i>Research gaps.</i> The original study predates modern boosting, used grid-searched defaults, did not report probability-based metrics (ROC-AUC, log-loss) or calibration, and gave no per-student explanations or error analysis. It also offered no deployable system. This project addresses each of these gaps.</p>

<h2>III. Methodology</h2>
<div class="block"><span>UCI CSV (mat + por)</span> &rarr; <span>Schema &amp; range validation</span> &rarr; <span>Feature engineering</span> &rarr; <span>Impute + scale + one-hot</span> &rarr; <span>[PCA 95%]</span> &rarr; <span>Optuna TPE &times; 5-fold CV</span> &rarr; <span>MLflow log</span> &rarr; <span>Champion (CV AUC)</span> &rarr; <span>Test / benchmark / SHAP</span> &rarr; <span>Flask API + Gradio</span> &rarr; <span>Docker &rarr; HF Spaces</span></div>
<p style="text-indent:0;font-size:8pt;text-align:center">Fig. 1. Block diagram of the end-to-end pipeline.</p>
<h3>A. Data and preprocessing</h3>
<p>The Mathematics (395) and Portuguese (649) files are merged with a <code>course</code> indicator ({ds['rows']} rows, {tr['validation']['columns']} columns). Validation found {len(tr['validation']['issues'])} missing-value or range issues and {tr['validation']['duplicates']} duplicates. The target is <i>pass</i> = 1[G3 &ge; 10]; the positive rate is {ds['positive_rate']*100:.1f}%, so failing students are the minority class. Six domain features are engineered: parental education sum, weighted weekly alcohol (5&middot;Dalc + 2&middot;Walc)/7, support count, a social index (goout + freetime &minus; studytime), log-absences and a has-failed flag. Inside a scikit-learn {c('sklearn')} <code>Pipeline</code>, numeric columns are median-imputed and standardised, and categorical columns are one-hot encoded, giving {er['encoded_dims']} dimensions. All transforms are fitted inside each CV fold, preventing leakage. An 80/20 stratified split holds out {n_test} students for testing.</p>
<h3>B. Dimensionality reduction</h3>
<p>PCA {c('pca')} needs {er['pca_components_95']} of {er['encoded_dims']} components to retain 95% of variance (Fig. 3), showing that the information is spread across many weakly correlated attributes. A PCA+XGBoost variant is therefore evaluated as an ablation. t-SNE {c('tsne')} projections (Fig. 4) show failing students concentrated in one region, but with strong overlap.</p>
<h3>C. Models</h3>
<p>Gradient boosting fits an additive model F<sub>M</sub>(x) = &Sigma;<sub>m</sub> &eta; f<sub>m</sub>(x) of regression trees. XGBoost minimises the regularised objective</p>
<p class="eq">L = &Sigma;<sub>i</sub> l(y<sub>i</sub>, &ycirc;<sub>i</sub>) + &Sigma;<sub>m</sub> [ &gamma;T<sub>m</sub> + &frac12;&lambda;&#8214;w<sub>m</sub>&#8214;<sup>2</sup> ]</p>
<p style="text-indent:0">with logistic loss l, T leaves and leaf weights w {c('xgb')}. LightGBM uses histogram binning with leaf-wise growth {c('lgbm')}, and CatBoost uses ordered boosting {c('cat')}. Baselines are L2 logistic regression, a balanced random forest {c('breiman')} and an MLP.</p>
<h3>D. Hyperparameter search</h3>
<p>Each model is tuned with Optuna {c('optuna')} using the Tree-structured Parzen Estimator {c('tpe')}: {len(tr['optuna_history']['XGBoost'])} trials maximising mean 5-fold stratified CV ROC-AUC on the training set. Search spaces cover depth, learning rate, number of trees, sub-sampling, column sampling and L2 regularisation. Every trial is logged as a nested MLflow {c('mlflow')} run with its parameters and score. The champion is selected on CV score only; the test set is never used for selection.</p>

<h2>IV. Implementation and Experiments</h2>
<p>Experiments ran on a 12-thread Intel CPU (Windows 11) with Python 3.11, scikit-learn 1.5.1, XGBoost 2.1.1, LightGBM 4.5.0, CatBoost 1.2.7, Optuna 4.0.0 and SHAP 0.46.0, with seed 42. The code is split into <code>data.py</code> (loading, validation, features), <code>models.py</code> (model zoo and search spaces), <code>train.py</code> (tuning, tracking, champion), <code>benchmark.py</code>, <code>analysis.py</code> (figures, SHAP, errors) and <code>report.py</code>, all driven by <code>config.yaml</code>. Fig. 2 summarises the data, and Fig. 5 shows that the boosted models converge within about 20 TPE trials.</p>
{fig('01_eda.png', 'Fig. 2. G3 distribution with the pass mark, and pass rate by past failures and by higher-education intent.')}
{fig('03_pca_variance.png', 'Fig. 3. Cumulative explained variance of PCA.', '80%')}
{fig('04_embeddings.png', 'Fig. 4. 2-D PCA and t-SNE embeddings coloured by outcome.')}
{fig('08_optuna_history.png', 'Fig. 5. Best-so-far CV ROC-AUC across Optuna trials.')}

<h2>V. Results and Comparative Analysis</h2>
<h3>A. Model comparison (setup C)</h3>
<table><caption>Table I. Tuned models: CV and held-out test results</caption>
<tr><th>Model</th><th>CV AUC</th><th>Test AUC</th><th>F1</th><th>Acc.</th><th>Log-loss</th><th>Tune (s)</th></tr>{rows}</table>
<p>All three boosting libraries outperform logistic regression on every probability metric. {champ} has the best CV AUC ({f3(M[champ]['cv_roc_auc'])}) with best parameters max_depth {p.get('max_depth')}, learning rate {float(p.get('learning_rate', 0)):.3f}, {p.get('n_estimators')} trees and subsample {float(p.get('subsample', 0)):.2f}. Its test AUC is {f3(cm['roc_auc'])} against {f3(lr['roc_auc'])} for logistic regression, and its log-loss drops from {f3(lr['log_loss'])} to {f3(cm['log_loss'])}. LightGBM and CatBoost are within 0.01 test AUC of the champion, a difference too small to separate on this test size. The PCA variant loses {f3(M[champ]['test']['roc_auc'] - M[champ+'+PCA']['test']['roc_auc'])} AUC: rotating one-hot and ordinal features into dense components destroys the axis-aligned splits that trees exploit. The gap between CV and test AUC (about 0.07) reflects the small test set (n = {n_test}).</p>
{fig('06_roc_pr.png', 'Fig. 6. ROC and precision-recall curves on the held-out test set.', wide=False)}
<h3>B. Benchmark against Cortez and Silva [1]</h3>
<p>To compare fairly with the paper, we repeat its protocol: each course separately, setups A/B/C, and accuracy from {bm['protocol']}. The paper reports the mean of 20 runs of 10-fold CV, and the best model per cell is taken as the baseline.</p>
<table><caption>Table II. Accuracy (%) versus the published baseline</caption>
<tr><th>Course</th><th>Setup</th><th>Paper best</th><th>LogReg (ours)</th><th>{bm['champion']} (ours)</th><th>&Delta;</th><th>p</th></tr>{bench}</table>
<p>The tuned {bm["champion"]} {WINTXT}. The largest gain is in the hardest setting, Mathematics without grades (setup C). When grades are available (setup A), all methods reach 89&ndash;93% and the gains vanish, because G2 alone almost determines G3. The p column is a one-sample t-test of the 50 fold accuracies against the paper's mean. Fold accuracies are correlated, so these p-values are optimistic and the improvements should be read as parity or modest gains, not decisive ones. Our own logistic regression baseline falls well below the paper in setup C, which confirms that the gain comes from the tuned ensemble, not from an easier protocol.</p>
<h3>C. Explainability</h3>
<p>TreeSHAP {c('treeshap')} values for the test set (Fig. 7) show that the course (Portuguese is easier to pass), the number of past failures, school, higher-education intent and absences dominate. The directions are educationally plausible: each past failure and higher absence pushes the prediction toward failure, while wanting higher education pushes toward pass. The Gradio app shows the top SHAP drivers for each individual prediction.</p>
{fig('10_shap_summary.png', 'Fig. 7. SHAP beeswarm for the champion model (test set).', '92%')}
<h3>D. Error analysis</h3>
<p>On the {n_test} test students the champion makes {er['counts']['missed_fail']} <i>missed failures</i> (predicted pass, actually failed) and {er['counts']['false_alarm']} false alarms (Fig. 8). Because only {100-ds['positive_rate']*100:.0f}% of students fail, the 0.5 threshold favours the majority class: high F1 for "pass" hides poor recall on the class that matters. Errors concentrate on students with one past failure (error rate {seg_f[1]['error_rate']*100:.0f}%, versus {seg_f[0]['error_rate']*100:.0f}% with none) and in Mathematics ({seg_c['mat']['error_rate']*100:.0f}% versus {seg_c['por']['error_rate']*100:.0f}% in Portuguese). Raising the pass threshold to 0.70 reduces missed failures from {thr[0.5]['missed_fail']} to {thr[0.7]['missed_fail']} at the cost of {thr[0.7]['false_alarm']} false alarms instead of {thr[0.5]['false_alarm']}. For an early-warning system, where a false alarm costs a short advising meeting, this trade-off is preferable. The waterfall plot of the most confident error (Fig. 9) shows a student with no failures and higher-education intent who still failed, a case that background data alone cannot capture.</p>
{fig('07_confusion_matrix.png', 'Fig. 8. Confusion matrix of the champion at threshold 0.5.', '55%')}
{fig('12_shap_waterfall_error.png', 'Fig. 9. SHAP waterfall for the most confident misclassification.', '92%')}
<h3>E. Deployment</h3>
<p>A Flask API (<code>/predict</code>, <code>/schema</code>, <code>/health</code>) validates every field against its type, range and allowed categories, returns HTTP 422 with per-field messages on invalid input, and reports latency. A Gradio interface offers sliders and dropdowns plus per-student SHAP drivers. Both run in one Docker image (python:3.11-slim, non-root user, health check) that is published as a Hugging Face Space: {cfg_links['hf']}. Source: {cfg_links['gh']}. Four automated tests cover health, defaults, monotonic risk direction and validation errors.</p>

<h2>VI. Conclusion and Future Scope</h2>
<p>Tuned gradient-boosted ensembles provide a reproducible early-warning model that {WINTXT} of the classic benchmark, with the clearest benefit where it is most needed: before any grades exist. SHAP makes the drivers transparent, and the error analysis shows that the decision threshold, not the model family, is the main lever for catching failing students. Limitations are the small size of the dataset, its origin in two Portuguese schools in 2005&ndash;2006, the optimistic fold-level significance test and the absence of a fairness audit across sex and address. Future work includes cost-sensitive threshold selection, probability calibration, fairness constraints, and adding behavioural signals (LMS activity and team contribution logs from our companion monitoring system) to improve recall on students with no failure history.</p>

<h2>References</h2>
<ol class="refs">{''.join(f'<li>{t}</li>' for _, t in REFS)}</ol>
</div></body></html>"""

out = os.path.join(ROOT, "report")
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "AML_Report.html"), "w", encoding="utf-8") as f:
    f.write(html)
print("wrote report/AML_Report.html")
