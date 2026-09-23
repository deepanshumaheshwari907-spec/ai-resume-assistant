ResumeAI Frontend

React frontend for ResumeAI, an AI-powered career workspace for resume optimization, job matching, application preparation, and application tracking.

Current Product Scope

The frontend currently provides UI for:

User signup, email OTP verification, and login

Resume upload and saved resume analysis

Deterministic ATS scoring with score breakdown

Resume history

Job-description matching

AI resume rewriting

Cover-letter generation

Mock interview practice

Opportunity management

Application metadata such as deadlines, applied dates, follow-ups, notes, and source URLs

Application preparation

Application activity timeline

Application analytics

Kanban-style application tracking

Application Pack PDF download

The repository is currently in active development / pre-launch. Production deployment and several future capabilities are still in progress.

Tech Stack

Frontend

React

React Router

Axios

jsPDF

Lucide React

React Hot Toast

Backend

FastAPI

Python

SQLAlchemy

SQLite

JWT authentication

Email OTP

Gemini API by default

OpenAI as an alternative AI provider

pdfplumber

Local Development

Prerequisites

Node.js

npm

Python 3

A running ResumeAI backend

Frontend Setup

From the repository root:

cd frontend
npm install

Create a frontend environment file:

REACT_APP_API_URL=http://127.0.0.1:8000

Then start the development server:

npm start

The frontend is normally available at:

http://localhost:3000

Backend

Start the FastAPI backend separately from the backend directory:

cd backend
python -m venv .venv

Windows:

.venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Create .env from backend/.env.example and configure the required provider/auth/email settings.

Run:

uvicorn main:app --reload

Backend documentation:

http://127.0.0.1:8000/docs

Frontend Structure

frontend/
├── public/
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── App.js
│   ├── App.css
│   ├── index.css
│   └── index.js
├── package.json
├── package-lock.json
└── README.md

Main Pages

The current frontend includes:

Landing page

Login

Signup

Dashboard

Terms

Not Found

The authenticated dashboard contains the main resume and application-workspace flows.

API Integration

The frontend communicates with the FastAPI backend through the shared API client.

The API base URL is configurable with:

REACT_APP_API_URL=http://127.0.0.1:8000

When the environment variable is not set, the frontend uses the local backend URL.

Authenticated requests use the JWT stored by the application's authentication context.

Application Workspace

The dashboard is designed around a single workflow:

Resume
  ↓
Analyze
  ↓
Match with Job
  ↓
Tailor Resume
  ↓
Generate Cover Letter
  ↓
Prepare Application
  ↓
Track Application
  ↓
Review Timeline & Analytics

Application records can retain:

Company

Job title

Job description

Match score

Deadline

Applied date

Follow-up date

Notes

Source URL

Tailored resume

Cover letter

Application pack

Engineering Notes

The frontend intentionally treats deterministic backend scores as application data rather than attempting to recalculate ATS or JD-match scores in the browser.

For changes to application workflows:

Keep API contracts aligned with the FastAPI backend.

Preserve authenticated request behavior.

Refresh persisted opportunity state after mutations where required.

Keep user-facing loading, success, and error states explicit.

Verify the affected workflow locally before committing.

Security

Do not put API keys, application secrets, email credentials, or other backend secrets in the frontend.

Frontend environment variables should contain only configuration that is safe to expose to the browser.

Backend secrets belong in backend/.env and must never be committed.

Current Scope vs Roadmap

This README documents the currently implemented frontend scope.

Future work may include additional deployment infrastructure, richer evaluation workflows, expanded interview preparation, onboarding improvements, and other product capabilities. Future items should not be treated as implemented until they are present in the codebase.

License

ResumeAI is distributed under the MIT License. See the repository root LICENSE file.