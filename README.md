# 🚀 TrialGuard

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | Winterarc |
| **Track** | AI |
| **Team Lead** | Bhargav Rakholiya — 24dcs106@charusat.edu.in |
| **Members** | Param Vadhadiya, gabani dharm, manav merja |

---

## 🎯 Problem Statement

Clinical research associates (CRAs) and study sponsors lack real-time, consolidated visibility into multi-site clinical trials. This fragmentation delays the detection of protocol deviations and adverse events, compromising patient safety, inflating trial costs, and risking regulatory audit failures.

---

## 💡 Solution

We built Aegis Clinical, a centralized dashboard that tracks clinical trial data across all sites in real-time. It automatically flags protocol deviations and highlights high-risk sites, allowing research teams to respond instantly and keep the trial safe and compliant.

---

## ✨ Key Features

- **Live Dashboard:** See all clinical sites and patients in one place.
- **Issue Tracking:** Automatically catches and flags any rule violations.
- **Site Risk Scores:** Highlights which sites need the most help using color codes.
- **AI Document Reader:** Quickly extracts rules from long medical documents.
- **Clean Design:** Very easy-to-use and professional interface.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python, TypeScript |
| **Frameworks** | FastAPI, React, Tailwind CSS |
| **IBM Technologies** | watsonx.ai |
| **Databases** | NeonDB |
| **Other** | Framer Motion |

---

## 📁 Repository Structure

```
├── src/                  # All source code
├── docs/                 # Written documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
├── demo/                 # Demo artifacts
│   ├── screenshots/      # App screenshots
│   └── demo-video-link.txt  # Link to demo video
├── presentation/         # Slide deck
└── submission.yaml       # Structured submission metadata
```

---

## ⚡ How to Run

> **Copy these exact steps from your [`docs/setup-guide.md`](docs/setup-guide.md)**

```bash
# 1. Clone the repo
git clone https://github.com/dharm2112/bob-ai-hackathon-Winterarc.git
cd bob-ai-hackathon-Winterarc

# 2. Install backend dependencies
pip install -r src/requirements.txt

# 3. Install frontend dependencies
cd src/frontend && npm install && cd ../..

# 4. Configure environment
cp src/.env.example src/.env
# Edit src/.env — fill in WATSONX_APIKEY, WATSONX_PROJECT_ID, WATSONX_URL, WATSONX_MODEL_ID

# 5. Run the backend
uvicorn src.backend.main:app --reload --port 8000

# 6. Run the frontend (separate terminal)
cd src/frontend && npm run dev
```

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/slides.pdf](presentation/) |

---

## 🏅 What We're Most Proud Of

We are most proud of how we seamlessly integrated AI-driven insights into a beautiful, high-performance 'Mission Control' interface. We successfully took complex, data-heavy clinical trial telemetry and distilled it into a clean, minimalist design that reduces cognitive load for researchers, proving that enterprise medical tools can be both powerful and intuitive.

---

## ⚠️ Known Limitations

Replace with any known limitations, incomplete features, or shortcuts taken due to time constraints.

---
