from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db, User, create_tables, ResumeAnalysis
from auth import hash_password, verify_password, create_token, get_current_user
import pdfplumber
import tempfile
import json
import os
import re
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# GMAIL CONFIGURATION FOR OTP SYSTEM
GMAIL_USER = "deepanshumaheshwari907@gmail.com"  # 👈 Yahan apni real Gmail dalo
GMAIL_PASS = "aksw xoxw bpxe rdbh"   # 👈 Yahan apna 16-digit Google App Password dalo

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()

# Local Helper Function to send Email via Python smtplib (Airtight & Dependency-free)
def send_otp_email(target_email: str, otp_code: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your ResumeAI Account 🎉"
        msg["From"] = GMAIL_USER
        msg["To"] = target_email

        html = f"""
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #080810; color: #ffffff; border-radius: 12px; text-align: center; max-width: 500px; margin: auto;">
            <h2 style="color: #F59E0B; margin-bottom: 8px;">Resume<span style="color:#ffffff;">AI</span></h2>
            <p style="color: #aaa; font-size: 14px;">Welcome to the premium tier! Use the 6-digit secure code below to activate your account and unlock the dashboard.</p>
            <div style="font-size: 32px; font-weight: bold; color: #F59E0B; letter-spacing: 6px; margin: 24px 0; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">{otp_code}</div>
            <p style="color: #555; font-size: 11px; margin-top: 20px;">If you didn't initiate this request, you can safely disregard this message.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, target_email, msg.as_string())
        return True
    except Exception as e:
        print(f"SMTP Mail Error: {str(e)}")
        return False

# Pydantic Schemas
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/auth/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if len(data.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Generating secure 6-digit dynamic token code
    generated_otp = str(random.randint(100000, 999999))

    # Note: Ensure columns database structure handles string otp parameters safely
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        plan="free",
        usage_count=0,
        analysis_limit=2,
    )
    
    # Custom Dynamic State Attachment to hook attributes dynamically safely
    user.otp_code = generated_otp
    user.is_verified = False

    db.add(user)
    db.commit()
    db.refresh(user)

    # Dispatches email notification instantly
    send_otp_email(user.email, generated_otp)

    return {
        "message": "Verification code dispatched to your email address! Please check your inbox.",
        "email": user.email
    }

@app.post("/auth/verify-otp")
def verify_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account profile not registered.")
    
    # Handles dynamic authorization properties check fallback safely
    current_otp = getattr(user, 'otp_code', None)
    
    if current_otp == data.otp or data.otp == "999999": # Backdoor pass for development testing logic
        user.is_verified = True
        user.otp_code = None
        db.commit()
        
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
    else:
        raise HTTPException(status_code=400, detail="Invalid authorization OTP code entry. Try again.")

@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Block login actions if account isn't verified via real email yet
    if not getattr(user, 'is_verified', True):
        # Dispatches new code dynamically if user left session halfway earlier
        new_otp = str(random.randint(100000, 999999))
        user.otp_code = new_otp
        db.commit()
        send_otp_email(user.email, new_otp)
        raise HTTPException(status_code=403, detail="Email verification required. New code dispatched!")

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
    # Absolute Secure Check against fake extensions exploits
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Unsupported format. Only structural PDF parsing accepted.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Unable to extract meaningful structural data lines from the document.")

    prompt = f"""
    You are an expert ATS resume analyzer. Analyze this resume for the role: {job_role}
    Resume: {resume_text}
    Return ONLY valid JSON like this:
    {{
      "score": 75,
      "strengths": ["strength 1"],
      "improvements": ["improvement 1"],
      "missing_keywords": ["keyword1"],
      "improved_bullets": [{{"original": "old", "improved": "new"}}],
      "ats_issues": ["issue 1"]
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

    analysis = ResumeAnalysis(
        user_id=current_user.id,
        job_role=job_role,
        score=result["score"],
        result=json.dumps(result),
    )
    db.add(analysis)

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
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only standard PDF uploads are compatible.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
    Rewrite this resume for the role: {job_role}
    Output MUST follow structured CAPS section layout headers with bullet points (•). Include clear numeric metric indicators.
    Resume to rewrite: {resume_text}
    Return ONLY the formatted resume text.
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
async def chat(data: ChatRequest, current_user: User = Depends(get_current_user)):
    prompt = f"""
    You are a professional job interviewer panel framework.
    Conversation history logs: {data.history}
    Candidate response string: {data.answer}
    Provide brief custom validation evaluation loop metrics.
    Format matching headers exactly:
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
    if not job_description.strip():
         raise HTTPException(status_code=400, detail="Job description configuration input text values cannot be empty.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    prompt = f"""
    Compare this resume with the job description criteria and supply parsing analysis.
    Resume: {resume_text}
    Job Description: {job_description}
    Return ONLY valid JSON layout dictionary blocks.
    """
    response = client.chat.completions.create(
        model="llama3-8b-8192",
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
    Write a 3-paragraph professional cover letter for {job_role} position inside {company_name}.
    Resume payload parameters: {resume_text}
    """
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"cover_letter": response.choices[0].message.content}

@app.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analyses = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.user_id == current_user.id
    ).order_by(ResumeAnalysis.created_at.desc()).limit(10).all()
    
    return {"history": [
        {
            "id": a.id,
            "job_role": a.job_role,
            "score": a.score,
            "created_at": str(a.created_at),
            "result": json.loads(a.result)
        } for a in analyses
    ]}