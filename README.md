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
