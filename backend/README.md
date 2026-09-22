ResumeAI Backend

FastAPI backend for ResumeAI, an AI-powered career workspace.

AI Provider Architecture

ResumeAI uses a provider-based AI service layer with Gemini as the default local/free-development provider and OpenAI as an alternative provider.

Configure the provider through:

AI_PROVIDER=gemini

Supported providers:

gemini — default provider for local/free development

openai — alternative provider for environments using OpenAI

Gemini

The current default Gemini model is:

GEMINI_MODEL=gemini-3.5-flash-lite

Required variable:

GEMINI_API_KEY=

OpenAI

OpenAI can be selected with:

AI_PROVIDER=openai

Configuration:

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_MODEL=gpt-5.6-terra

AI Reliability Architecture

ResumeAI does not delegate every numeric decision to an LLM.

For example:

ATS numeric scoring is calculated by ats_engine.py.

Job-description matching is calculated by jd_match_engine_v2.py.

The AI service layer is used for explanations, rewriting, cover letters, and other generated text.

Pydantic models validate structured AI responses before they are used by the application.

This separation is intended to make numeric outputs more deterministic while keeping generative tasks flexible.

Local Setup

Create and activate a virtual environment:

python -m venv .venv

Windows:

.venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Create your environment file:

copy .env.example .env

Then configure the required values in .env.

At minimum, local development typically requires:

AI_PROVIDER

the API key for the selected AI provider

SECRET_KEY

ADMIN_SECRET

email variables when OTP/email functionality is enabled

GOOGLE_CLIENT_ID when Google OAuth is enabled

The complete example configuration is available in backend/.env.example.

Run the Backend

From the backend directory:

uvicorn main:app --reload

The development API is normally available at:

http://127.0.0.1:8000

Interactive API documentation:

http://127.0.0.1:8000/docs

Health check:

GET /

Main Backend Responsibilities

The FastAPI backend currently handles:

Authentication and JWT-based sessions

Email OTP flows

Resume upload and saved resume analysis

Deterministic ATS scoring

Deterministic job-description matching

AI resume rewriting

Cover-letter generation

Mock interview functionality

Opportunity management

Application tracking metadata

Application activity timeline

Application analytics

Application preparation workflows

PDF generation/download support

Data and Storage

The current local development database uses SQLite by default:

DATABASE_URL=sqlite:///./resumeai.db

The local database file is intentionally excluded from Git.

The backend uses SQLAlchemy for database access.

Security

Never commit:

.env

real API keys

JWT/application secrets

email passwords

OAuth secrets

local database files

other production credentials

Use .env.example as the shareable configuration template.

Project Structure

Important backend files:

backend/
├── main.py
├── database.py
├── auth.py
├── openai_service.py
├── ats_engine.py
├── jd_match_engine_v2.py
├── requirements.txt
├── .env.example
└── README.md

Despite the filename openai_service.py, the current AI service layer supports both Gemini and OpenAI providers.

Development Notes

When changing AI behavior:

1. Keep deterministic scoring logic separate from  generative logic where practical.

2. Validate structured AI output with the existing Pydantic models.

3. Keep provider-specific configuration in environment variables.

4. Do not put secrets directly in source code.

5. Test the affected API flow through the FastAPI application before committing changes.

Current Scope

This backend README documents the current implemented architecture. Planned infrastructure, evaluation systems, deployment improvements, additional AI capabilities, and other roadmap work should not be treated as implemented until they are added to the codebase.