# Smart Team Contribution Monitoring System

AI-based continuous effort verification and free-riding detection for
collaborative student projects. One system, three layers:

- **Full Stack** (`frontend/`, `backend/`): React + Node/Express + MongoDB REST API, student & faculty dashboards, task CRUD.
- **ANN** (`ann-service/`): Keras neural network trained on a simulated activity dataset to predict contribution-risk probability, served via a small Flask API.
- **AI System Engineering** (`backend/src/agents/`): a multi-agent pipeline — Edit Agent, Task Agent, Communication Agent, Risk Agent (calls the ANN), Decision Agent (Allow / Nudge / Alert) — orchestrated per student and logged with explanations for faculty.

## Architecture

```
React frontend  --->  Node/Express API  --->  MongoDB
                              |
                              v
                     Agent Orchestrator
                    /      |       \
              Edit Agent  Task Agent  Communication Agent
                    \      |       /
                        Risk Agent  ---> ANN microservice (Flask + Keras)
                              |
                        Decision Agent
                              |
                    Prediction saved + surfaced on Faculty Dashboard
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- A running MongoDB instance (local `mongod`, or a free MongoDB Atlas cluster — set `MONGO_URI` accordingly)

## 1. Train the ANN and start its prediction service

```bash
cd ann-service
python -m venv venv
venv\Scripts\activate        # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train_model.py        # generates dataset.csv, model.h5, scaler.pkl, metrics.json
python predict_service.py    # serves POST /predict on :5001
```

`metrics.json` contains accuracy/precision/recall/F1/ROC-AUC/confusion matrix from the held-out test split — use this for the ANN subject's evaluation writeup.

If this service isn't running, the backend's Risk Agent automatically falls back to an equivalent rule-based heuristic, so the rest of the app still works for a quick demo.

## 2. Start the backend

```bash
cd backend
copy .env.example .env       # edit MONGO_URI if needed
npm install
npm run seed                 # creates 1 faculty + 1 team of 4 students with 7 days of varied activity, then runs predictions
npm run dev                  # http://localhost:5000
```

Seed prints the demo login credentials, e.g.:

```
Faculty login:  faculty@example.edu / password123
Student logins: 23cs001@example.edu ... 23cs004@example.edu / password123
```

The seeded students have deliberately different patterns (strong / average / declining / free-rider) so the faculty dashboard shows a realistic spread of risk levels immediately.

## 3. Start the frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

Log in as faculty to see the team overview, risk badges, and per-student agent explanations with a feedback (correct/incorrect) loop. Log in as a student to see personal tasks, activity, contribution score, and AI feedback, with a button to log a day's activity and re-run the pipeline live.

## Portals

- **Student portal** (`/student`): Overview (score ring, rank in team, activity chart, tasks), Activity (log work, daily breakdown), Tasks (update status), AI feedback (score breakdown, trend, reasons).
- **Faculty portal** (`/faculty`): Teams (every team as a card), a page per team (member scores, trend, activity, member table), a page per student (breakdown, reasons, review form), Analytics (risk distribution, team comparison, trends, model comparison and drift), Alerts.
- The demo seed creates 4 teams and 17 students (`23cs001` to `23cs017`). Earlier weekly score snapshots are generated demo data so the trend charts have history.

## AML layer: advanced machine learning workflow

`ann-service/` also holds the practical ML lifecycle around the ANN:

| Stage | File | What it does |
|---|---|---|
| Data validation | `aml_pipeline.py` | Range, missing-value and class-balance checks; training stops if they fail |
| Model comparison | `aml_pipeline.py` | Logistic Regression, Random Forest, Gradient Boosting, sklearn MLP vs the deployed Keras ANN, 5-fold stratified CV, same held-out split |
| Tuning | `aml_pipeline.py` | GridSearchCV on Random Forest and Gradient Boosting |
| Explainability | `aml_pipeline.py` | Permutation feature importance, ROC curves in `aml_comparison.png` |
| Model registry | `aml_pipeline.py` | Versioned models plus `models/registry.json` (metrics, dataset hash, timestamp) |
| Deployment | `predict_service.py` | `/predict` (returns `model_version`), `/model/info`, `/model/drift` |
| Monitoring | `drift_monitor.py` | KS test and PSI of live inputs vs training data; `--demo` simulates a disengaging cohort |
| Feedback and retraining | `retrain.py` | Pulls faculty-reviewed predictions from `/api/faculty/feedback-export`, appends them, retrains, reruns the comparison |

```bash
python train_model.py && python aml_pipeline.py
python drift_monitor.py --demo
python retrain.py --token <faculty JWT>
```

The faculty dashboard shows the model comparison table and drift status.

## Project structure

```
backend/
  src/
    models/       Mongoose schemas (User, Team, Task, Activity, Prediction)
    agents/        editAgent, taskAgent, communicationAgent, riskAgent, decisionAgent, orchestrator
    routes/         auth, students, tasks, faculty
    middleware/    JWT auth
  scripts/seed.js  demo data generator
ann-service/
  train_model.py     synthetic dataset + Keras ANN training + metrics
  predict_service.py Flask inference API used by the Risk Agent
frontend/
  src/pages/         Login, StudentDashboard, FacultyDashboard, StudentDetail
```
