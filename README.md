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
Student logins: 23cs001@example.edu ... 23cs009@example.edu / password123
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
- The demo seed is the **Advanced Machine Learning** course with 9 students (`23cs001` to `23cs009`), 3 assignments and these teams for Assignment 2: Team 1 (Dharun, Arun, Priya), Team 2 (Karthik, Meena), Team 3 (Sanjay, Divya). Naveen (`23cs008`) and Rekha (`23cs009`) are not on a team yet, so they can create one. Earlier weekly score snapshots are generated demo data so the trend charts have history.

## Assignments, contribution shares and academic risk

Faculty start at **Assignments** (`/faculty`):

1. Connect Google Classroom, pick a course and sync. Assignments then appear.
2. An **individual** assignment lists students with submitted, score, late, attempts and contribution (100% if submitted, 0% if not).
3. A **team** assignment lists its teams. Open a team for each member's contribution share, tasks and status, then a member for the full analysis.

**Student portal assignments** (`/student/assignments`) has two tabs: Individual and Contributed. Individual cards show due date, submission status, marks, student activity and faculty feedback, and open to the full submission and activity history. Contributed cards show due date, team, team members and the student's estimated contribution, and open to the team with every member's percentage. **+ Create Team** exists only on contributed assignments (disabled once the student is on a team), for students and faculty. Creating a team never sets contribution. Shares are always estimated from recorded activity, so a newly created team gets estimates from its members' commits and document edits since the assignment was set, and shows "Not enough activity yet" when nothing is recorded. Students can open only their own team.

**Google Classroom is simulated.** `backend/src/services/classroom.js` generates courses, coursework and submissions. A real provider would call `courses.list`, `courses.courseWork.list` and `studentSubmissions.list` with the faculty member's OAuth token and return the same shapes. Classroom has no individual/team concept, so the type is part of the simulated coursework.

**Contribution share** (`backend/src/services/contribution.js`) is an estimate. Each student's share of the team is computed per component and weighted: tasks 40%, git 30%, documentation 10%, peer evaluation 10%, faculty evaluation 10%. A team's shares add to 100%. Git, document and rating data are seeded demo data, not collected from Classroom.

**Feature table for the risk model.** Each Classroom sync (and each new team) rebuilds `StudentAssignmentRecord`, one row per student per assignment: `student_id, assignment_id, assignment_type, team_id, attendance, assignment_score, submission_status, late_submission, comments_count, relevant_comments, tasks_completed, project_interactions, activity_score, contribution_score`. Faculty can download it from the Assignments page. `node scripts/generate-dataset.js 60` builds a large cohort (about 650 rows) in `ann-service/data/student_assignment_records.csv` using an in-memory database. The sample file there is generated demo data, not real students.

**Academic risk** is a separate model (`ann-service/academic_model.py`) using attendance, marks, GPA, submissions, late submissions, assignment scores, contribution ratio and task completion. It is trained on simulated data, so its scores describe the method. Train it with `python academic_model.py`; without it the backend uses a rule-based fallback.

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
