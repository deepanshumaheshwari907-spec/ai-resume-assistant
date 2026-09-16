# ResumeAI Backend

FastAPI backend for ResumeAI.

## AI provider

ResumeAI now uses the OpenAI **Responses API**.

- `gpt-5.6-luna` for cost-sensitive generation
- `gpt-5.6-terra` for ATS/JD/rewrite reasoning
- Structured Outputs for ATS and JD JSON responses

## Local setup

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `OPENAI_API_KEY` and the required auth/email variables in `.env`.

Run:

```bash
uvicorn main:app --reload
```

Health check:

```text
GET http://127.0.0.1:8000/
```

## Important

Never commit `.env`, API keys, database files, or production secrets.
