from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, User, create_tables
from auth import hash_password, verify_password, create_token, get_current_user
import pdfplumber
import tempfile
import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()

@app.get("/")
def health_check():
    return {"status": "ok"}

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        plan="free",
        usage_count=0,
        analysis_limit=2,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token({"user_id": user.id})
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "plan": user.plan,
            "usage_count": user.usage_count,
            "analysis_limit": user.analysis_limit,
        }
    }

@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"user_id": user.id})
    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "plan": user.plan,
            "usage_count": user.usage_count,
            "analysis_limit": user.analysis_limit,
        }
    }

@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan,
        "usage_count": current_user.usage_count,
        "analysis_limit": current_user.analysis_limit,
    }

@app.get("/make-pro/{email}")
def make_pro(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.plan = "pro"
    user.analysis_limit = 999
    user.usage_count = 0
    db.commit()
    return {"message": f"{email} is now Pro!"}

def extract_text(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    job_role: str = Form("Software Engineer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
You are an expert ATS resume analyzer.
Analyze this resume for the role: {job_role}

Resume:
{resume_text}

Return ONLY valid JSON like this:
{{
  "score": 75,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "missing_keywords": ["keyword1", "keyword2"],
  "improved_bullets": [
    {{"original": "old bullet", "improved": "new bullet"}}
  ],
  "ats_issues": ["issue 1", "issue 2"]
}}
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.choices[0].message.content
    start = raw.find("{")
    end = raw.rfind("}") + 1
    result = json.loads(raw[start:end])

    current_user.usage_count += 1
    db.commit()

    return {"result": result}

@app.post("/rewrite")
async def rewrite_resume(
    file: UploadFile = File(...),
    job_role: str = Form("Software Engineer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
Rewrite this resume for the role: {job_role}
Make it ATS-friendly, use strong action verbs, add metrics where possible.
Keep it professional and structured.

Resume:
{resume_text}

Return ONLY the rewritten resume text, no extra explanation.
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )

    return {"rewritten_resume": response.choices[0].message.content}

class ChatRequest(BaseModel):
    answer: str
    history: str

@app.post("/chat")
async def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
You are a professional job interviewer.
Conversation so far:
{data.history}

Candidate's answer: {data.answer}

Give brief feedback on their answer (2-3 lines), then ask the next interview question.
Format:
FEEDBACK: ...
NEXT QUESTION: ...
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.choices[0].message.content
    feedback, next_q = "", ""

    for line in content.split("\n"):
        if line.startswith("FEEDBACK:"):
            feedback = line.replace("FEEDBACK:", "").strip()
        elif line.startswith("NEXT QUESTION:"):
            next_q = line.replace("NEXT QUESTION:", "").strip()

    return {"feedback": feedback, "next_question": next_q}

@app.post("/match-jd")
async def match_jd(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
You are an expert ATS recruiter. Compare this resume with the job description.

Resume:
{resume_text}

Job Description:
{job_description}

Return ONLY valid JSON:
{{
  "match_score": 78,
  "matched_keywords": ["python", "machine learning"],
  "missing_keywords": ["docker", "kubernetes"],
  "strong_sections": ["Education matches well"],
  "weak_sections": ["Missing cloud experience"],
  "recommendation": "Your resume is a good fit. Add Docker skills to improve."
}}
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.choices[0].message.content
    start = raw.find("{")
    end = raw.rfind("}") + 1
    result = json.loads(raw[start:end])
    return {"result": result}

@app.post("/cover-letter")
async def generate_cover_letter(
    file: UploadFile = File(...),
    job_role: str = Form(...),
    company_name: str = Form("the company"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
Write a professional cover letter for:
Job Role: {job_role}
Company: {company_name}
Resume: {resume_text}

Write 3 paragraphs - opening, achievements, closing.
Return ONLY the cover letter text.
"""
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"cover_letter": response.choices[0].message.content}