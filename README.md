# ResumeAI

**AI-powered career workspace for resume optimization, job matching, application preparation, and application tracking.**

ResumeAI is a full-stack AI application built to bring the job-application workflow into one place:

> **Prepare → Match → Tailor → Apply → Track → Improve**

Built with **Python, FastAPI, React, SQLAlchemy, SQLite, REST APIs, and LLM APIs**.

> **Project status:** Active development / pre-launch  
> The repository describes the current implementation and the planned roadmap. Production deployment, automated evaluation coverage, and several future AI capabilities are still in progress.

---

## What is ResumeAI?

Job searching often becomes a collection of disconnected workflows: one tool for resume feedback, another for ATS checking, another for job matching, separate tools for cover letters and interview preparation, and spreadsheets or notes for application tracking.

**ResumeAI combines these workflows into a single career workspace.**

The current product can:

- analyze and score a resume for a target role
- identify matched and missing skills/keywords
- compare a resume against a job description
- generate role-specific resume rewrites
- generate job-specific cover letters
- prepare an application pack with interview questions and talking points
- track opportunities through an application pipeline
- store deadlines, follow-ups, notes, and source links
- maintain a persistent application activity timeline
- provide tracker-level application analytics

---

## Product Flow

```text
                         RESUMEAI
                            │
             ┌──────────────┴──────────────┐
             │                             │
        Resume Intelligence          Job Opportunities
             │                             │
      ┌──────┼──────┐             ┌────────┼─────────┐
      │      │      │             │        │         │
     ATS    Skills  History      Match   Tailor   Cover Letter
      │
      └───────────────┬──────────────────────────────┐
                      │                              │
                      ▼                              ▼
                Application Pack              Application Tracker
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                           Pipeline               Timeline              Analytics
```

---

## Core Features

### 1. Resume Intelligence

- Resume upload and persistent resume storage
- Resume history
- Target-role ATS analysis
- Deterministic 0–100 ATS scoring
- Role alignment and skills coverage analysis
- Experience/project relevance analysis
- Impact evidence and ATS readability checks
- Education/certification signals
- Matched and missing keyword reporting
- AI-generated explanations and improvement suggestions

### 2. Job Description Matching

- Resume-to-job-description matching
- Required vs preferred skill separation
- Matched and missing skills
- Deterministic 0–100 match score
- Score breakdown
- Evidence-based recommendations

### 3. AI-Powered Application Preparation

- Role-specific resume rewriting
- Job-specific cover-letter generation
- Application preparation pack
- Interview questions based on the role
- Resume-backed interview talking points

### 4. Application Tracker

Opportunities move through a persistent pipeline:

```text
Saved
  ↓
Analyzed
  ↓
Tailored
  ↓
Applied
  ↓
Interview
  ↓
Offer

      ↘ Closed
```

Each opportunity can store:

- Company
- Job title
- Job description
- Match score
- Application deadline
- Applied date
- Follow-up date
- Notes
- Source URL
- Tailored resume
- Cover letter
- Application pack

### 5. Application Activity Timeline

The tracker records major actions automatically, including:

- Opportunity creation
- Status changes
- Job-match analysis
- Resume tailoring
- Cover-letter generation
- Application-pack preparation
- Application-detail updates

Timeline events are stored in the database and remain available after refresh.

### 6. Application Analytics

Current tracker analytics include:

- Total opportunities
- Submitted applications
- Interviews
- Offers
- Response rate
- Average match score
- Pipeline stage counts
- Upcoming deadlines
- Follow-up actions

---

## AI Architecture

ResumeAI intentionally separates **deterministic scoring logic** from **LLM-generated explanations and text generation**.

### ATS Analysis

```text
Resume + Target Role
         │
         ▼
Deterministic ATS Engine
         │
         ├── Role Alignment
         ├── Skills Coverage
         ├── Experience / Project Relevance
         ├── Impact Evidence
         ├── ATS Readability
         └── Education / Certifications
         │
         ▼
      Score 0–100
         │
         ▼
      LLM Explanation
         │
         ▼
 Structured JSON
         │
         ▼
 Local Pydantic Validation
```

The numeric ATS score is produced by the deterministic engine. The LLM is used to explain the evidence and generate actionable guidance rather than replacing the scoring source of truth.

### Job Matching

```text
Resume + Job Description
           │
           ▼
Deterministic JD Match Engine
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
 Required Preferred General
 Skills    Skills   Terms
     │
     ▼
 Match Score + Evidence
     │
     ▼
 LLM Explanation
```

The matching engine uses fixed weighting for required, preferred, and general terms to keep the numeric result reproducible.

### Structured LLM Output

For structured AI responses, ResumeAI validates model output locally before using it in the application.

```text
LLM Response
     ↓
JSON Parsing
     ↓
Pydantic Validation
     ↓
Application Data
```

This reduces the risk of blindly trusting malformed model output.

---

## AI Provider Architecture

ResumeAI uses a provider-routing service layer.

Current code supports:

- **Gemini** for local/free development
- **OpenAI** as an alternative provider path

The provider is selected through environment configuration.

The application service layer also centralizes:

- resume analysis
- resume rewriting
- job matching
- cover letters
- interview turns
- application preparation

---

## Authentication & Data Model

The backend currently includes:

- JWT authentication
- Email OTP verification
- User-scoped data access
- Active resume management
- Persistent resume history
- Opportunity records
- Opportunity activity records

Sensitive configuration belongs in environment variables, not source control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 |
| Routing | React Router |
| HTTP Client | Axios |
| Backend | FastAPI |
| Language | Python |
| Database | SQLite |
| ORM | SQLAlchemy |
| Authentication | JWT + Email OTP |
| PDF Extraction | pdfplumber |
| PDF Generation | jsPDF |
| AI | Gemini / OpenAI provider architecture |
| Validation | Pydantic |
| UI Icons | Lucide React |
| Version Control | Git / GitHub |

---

## Repository Structure

```text
ai-resume-assistant/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── auth.py
│   ├── openai_service.py
│   ├── ats_engine.py
│   ├── jd_match_engine_v2.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── utils/
│   └── package.json
│
└── README.md
```

---

## Local Development

### Prerequisites

- Python 3.x
- Node.js / npm
- An LLM provider API key
- Git

### 1. Clone the repository

```bash
git clone https://github.com/deepanshumaheshwari907-spec/ai-resume-assistant.git
cd ai-resume-assistant
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create your environment file:

```powershell
copy .env.example .env
```

Then configure the provider credentials and required authentication/email values in `.env`.

Start the API:

```bash
uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend setup

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

Frontend:

```text
http://localhost:3000
```

---

## API Surface

The current backend exposes routes covering:

### Authentication

```text
POST /auth/signup
POST /auth/verify-otp
POST /auth/login
GET  /auth/me
```

### Resume

```text
POST /upload-resume
GET  /resume/latest
POST /analyze-saved-resume
POST /rewrite
GET  /history
```

### Job Matching & AI Assistance

```text
POST /match-jd
POST /cover-letter
POST /chat
```

### Application Opportunities

```text
POST   /opportunities
GET    /opportunities
GET    /opportunities/{id}
PATCH  /opportunities/{id}/status
PATCH  /opportunities/{id}/metadata
GET    /opportunities/{id}/activity
GET    /opportunities/analytics/summary
POST   /opportunities/{id}/match
POST   /opportunities/{id}/prepare-application
DELETE /opportunities/{id}
POST   /opportunities/{id}/tailor
POST   /opportunities/{id}/cover-letter
```

---

## ATS Scoring

The current ATS engine uses a fixed 100-point model:

| Dimension | Weight |
|---|---:|
| Role alignment | 25 |
| Skills coverage | 25 |
| Experience / project relevance | 20 |
| Impact evidence | 10 |
| ATS readability | 10 |
| Education / certifications | 10 |
| **Total** | **100** |

The score is deterministic for the same resume and target role, while the LLM provides explanation and recommendations around that score.

---

## Current Status

### Completed

- [x] Authentication and OTP verification
- [x] Resume upload and persistence
- [x] Resume history
- [x] Deterministic ATS engine
- [x] ATS explanation layer
- [x] Deterministic JD matching
- [x] AI resume rewriting
- [x] Cover-letter generation
- [x] Mock interview
- [x] Application preparation
- [x] Application Tracker
- [x] Kanban workflow
- [x] Application metadata
- [x] Persistent application timeline
- [x] Application analytics

### In Progress

- [ ] Production deployment
- [ ] Broader automated testing
- [ ] AI evaluation framework
- [ ] Better observability and failure diagnostics
- [ ] User onboarding improvements
- [ ] Public product launch

---

## Roadmap

ResumeAI is being developed in stages.

### Phase 1 — Core Career Workspace

- Resume intelligence
- Job matching
- Tailoring
- Cover letters
- Application workspace
- Tracker timeline
- Analytics

**Status: largely implemented**

### Phase 2 — AI Reliability & Evaluation

- Automated LLM evaluation datasets
- Quality benchmarks for generated outputs
- Regression checks for prompts/models
- Better retry and fallback handling
- Latency and failure monitoring
- Expanded automated tests

### Phase 3 — Production Infrastructure

- Production deployment
- Managed database
- Secure secret management
- Background processing where needed
- Logging and observability
- Rate limiting and abuse protection
- Performance improvements

### Phase 4 — Career Intelligence

- Better job discovery workflows
- Personalized application recommendations
- More context-aware application preparation
- Stronger interview preparation
- Career-progress insights

### Phase 5 — Beginner-Friendly Interview Coach

A major planned improvement is a beginner-first interview practice experience designed for candidates who are uncomfortable speaking English.

The goal is not only to ask interview questions, but to teach communication progressively:

```text
Very Basic English
        ↓
Simple Answers
        ↓
Grammar + Sentence Feedback
        ↓
Project Vocabulary
        ↓
Technical Explanations
        ↓
Mock Interview
        ↓
Interview Communication Practice
```

The system should help a beginner understand **what to say, how to say it, and why the improved version is better**, while gradually increasing interview difficulty.

### Phase 6 — Product Growth

- Better onboarding
- User feedback loops
- Product analytics
- Retention improvements
- Sharing / referral workflows
- Free-to-paid product strategy
- Real-user feedback driven iterations

---

## Engineering Principles

ResumeAI is being developed around a few principles:

### Reproducibility

Important numeric decisions such as ATS and JD-match scores should be reproducible rather than dependent entirely on an LLM's response.

### Explainability

AI-generated recommendations should be grounded in the user's resume and target job rather than fabricated.

### Structured AI Output

Structured AI responses are parsed and validated before being used by the application.

### Privacy & Secrets

API keys, authentication secrets, and other sensitive configuration belong in environment variables and should never be committed to the repository.

### Incremental Development

Features are implemented, tested locally, verified, and then committed to version control.

---

## Known Limitations

This project is still under active development.

- The current database setup defaults to SQLite for local development.
- Automated backend/frontend test coverage is still expanding.
- Production deployment and production-grade observability are not yet represented as completed features.
- AI output quality depends on the configured model/provider and prompt design.
- The beginner-focused English interview coach described in the roadmap is planned work, not part of the current release.

---

## Screenshots

Screenshots will be maintained under:

```text
docs/screenshots/
```

Planned showcase screenshots:

- Dashboard / Resume Intelligence
- Job Match
- Application Workspace
- Application Timeline
- Application Analytics

---

## Development Notes

ResumeAI has evolved from a resume-analysis MVP into a broader career workflow product.

Recent milestones include:

- Application Workspace 2.0
- Persistent application metadata
- Persistent application activity timeline
- Application Analytics V1

See the Git history for implementation details and milestone-by-milestone development.

---

## Future Vision

The long-term goal is to make ResumeAI more than a resume tool.

The direction is:

```text
Resume
   ↓
Understand your profile
   ↓
Find relevant opportunities
   ↓
Evaluate your fit
   ↓
Improve your application
   ↓
Prepare for interviews
   ↓
Apply
   ↓
Track outcomes
   ↓
Learn from the results
```

**One career workspace instead of a collection of disconnected tools.**

---

## License

License information will be added before the project is publicly released as a product.

---

## Author

**Deepanshu Maheshwari**

B.Tech — Artificial Intelligence & Machine Learning

GitHub:  
https://github.com/deepanshumaheshwari907-spec

Project repository:  
https://github.com/deepanshumaheshwari907-spec/ai-resume-assistant
