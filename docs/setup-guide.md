# Setup Guide

> **This file is read by the automated evaluation pipeline. Be precise and complete.**

## Prerequisites

Before you begin, ensure you have the following installed:

- [ ] Python 3.11+
- [ ] Node.js 18+
- [ ] An IBM Cloud account with watsonx.ai access

## Environment Variables

Copy `src/.env.example` to `src/.env` and fill in the values:

```bash
cp src/.env.example src/.env
```

| Variable | Description | Required |
|---|---|---|
| `WATSONX_APIKEY` | Your IBM Cloud API key | Yes |
| `WATSONX_PROJECT_ID` | Your watsonx.ai project ID | Yes |
| `WATSONX_URL` | Regional endpoint e.g. `https://us-south.ml.cloud.ibm.com` | Yes |
| `WATSONX_MODEL_ID` | Foundation model e.g. `ibm/granite-13b-instruct-v2` | Yes |
| `DATABASE_URL` | SQLite (default) or PostgreSQL connection string | No |
| `APP_ENV` | `development` \| `staging` \| `production` | No |
| `LOG_LEVEL` | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` | No |

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/dharm2112/bob-ai-hackathon-Winterarc.git
cd bob-ai-hackathon-Winterarc

# 2. Install backend dependencies
pip install -r src/requirements.txt

# 3. Install frontend dependencies
cd src/frontend
npm install
cd ../..
```

## Running the Application

```bash
# Start the backend (from repo root)
uvicorn src.backend.main:app --reload --port 8000

# Start the frontend (separate terminal, from repo root)
cd src/frontend && npm run dev
```

The backend will be available at: `http://localhost:8000`  
The frontend will be available at: `http://localhost:5173`  
API docs (Swagger): `http://localhost:8000/docs`

## Running Tests

```bash
# Backend unit tests
pytest src/tests/ -v

# Integration test (requires backend running on port 8000)
python integration_test.py
```

## Quick Demo

After the backend is running, trigger the rule engine to generate data:

```bash
# Generate synthetic trial data and run the rule engine
curl -X POST http://localhost:8000/run-engine \
  -H "Content-Type: application/json" \
  -d '{"num_sites": 5, "patients_per_site": 5}'
```

Then open the frontend at `http://localhost:5173` and click **Recalculate Risk** on the dashboard.

## Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r src/requirements.txt` from the repo root |
| `WatsonxConfigError` on startup | Check `WATSONX_APIKEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL` in `src/.env` |
| Frontend shows no data | Click **Recalculate Risk** on the dashboard to run the engine and populate the DB |
| CORS error in browser | Ensure `APP_ENV=development` in `src/.env` so the backend allows all origins |
| SQLite DB locked | Stop all running backend processes before restarting |
