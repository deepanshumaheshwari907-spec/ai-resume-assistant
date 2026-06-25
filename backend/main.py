from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db, User, create_tables, ResumeAnalysis
from auth import hash_password, verify_password, create_token, get_current_user, verify_admin
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

# --- GOOGLE AUTH PACKAGES ---
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_PASS = os.getenv("GMAIL_PASS", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,https://ai-resume-assistant-cyan.vercel.app",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()

# Local Helper Function to send Email via Python smtplib (Airtight & Dependency-free)
def send_otp_email(target_email: str, otp_code: str):
    if not GMAIL_USER or not GMAIL_PASS:
        print("Email not configured: set GMAIL_USER and GMAIL_PASS in .env")
        return False
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

class ChatRequest(BaseModel):
    answer: str
    history: str
    
class GoogleLoginRequest(BaseModel):
    token: str

class InterviewReportRequest(BaseModel):
    name: str
    email: str
    age: int
    branch: str
    chat_history: str

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

    generated_otp = str(random.randint(100000, 999999))

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        plan="free",
        usage_count=0,
        analysis_limit=2,
    )
    
    user.otp_code = generated_otp
    user.is_verified = False

    db.add(user)
    db.commit()
    db.refresh(user)

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
    
    current_otp = getattr(user, 'otp_code', None)
    
    if current_otp == data.otp: 
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
    
    if not getattr(user, 'is_verified', True):
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
def make_pro(email: str, db: Session = Depends(get_db), _: None = Depends(verify_admin)):
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
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Unsupported format. Only structural PDF parsing accepted.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    resume_text = extract_text(tmp_path)
    os.unlink(tmp_path)

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Unable to extract meaningful data lines from document.")

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
       model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.choices[0].message.content
    start = raw.find("{")
    end = raw.rfind("}") + 1
    result = json.loads(raw[start:end])

    analysis = ResumeAnalysis(
        user_id=current_user.id,
        job_role=job_role,
        score=int(result["score"]),
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
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"rewritten_resume": response.choices[0].message.content}

@app.post("/chat")
async def chat(data: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        user_answer = data.answer.strip()
        chat_history = data.history.strip()

        if user_answer.lower() == "start interview":
            return {
                "feedback": "Welcome to your interactive AI simulation session.",
                "next_question": "Excellent. Let's begin. Please tell me about your comprehensive background, your primary tech stack, and a technical project you built recently."
            }

        prompt = f"""
        You are a professional technical job interviewer panel framework.
        Conversation history logs: {chat_history}
        Candidate response string: {user_answer}
        
        Provide a very brief evaluation feedback on the user's answer, and then ask the next relevant technical interview question.
        You MUST structure your response strictly with these headers:
        FEEDBACK: [Write feedback here]
        NEXT QUESTION: [Write next question here]
        """
        
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.choices[0].message.content
        feedback, next_q = "", ""

        for line in content.split("\n"):
            if line.upper().startswith("FEEDBACK:"):
                feedback = line[len("FEEDBACK:"):].strip()
            elif line.upper().startswith("NEXT QUESTION:"):
                next_q = line[len("NEXT QUESTION:"):].strip()

        if not next_q:
            if "FEEDBACK:" in content and "NEXT QUESTION:" in content:
                parts = content.split("NEXT QUESTION:")
                feedback = parts[0].replace("FEEDBACK:", "").strip()
                next_q = parts[1].strip()
            else:
                feedback = "System processed your input metrics safely."
                next_q = content if content.strip() else "Can you describe how you manage production scalability?"

        return {"feedback": feedback, "next_question": next_q}

    except Exception as e:
        print(f"Chat Pipeline Crash Warning: {str(e)}")
        return {
            "feedback": "Database pipeline tracking active. Good baseline conceptual structure.",
            "next_question": "Can you explain how you handle state synchronization across distributed microservices?"
        }

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
    Return ONLY valid JSON layout dictionary blocks like this:
    {{
      "match_score": 75,
      "matched_keywords": ["python"],
      "missing_keywords": ["aws"],
      "recommendation": "Add cloud skills"
    }}
    """
    response = client.chat.completions.create(
        model=GROQ_MODEL,
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
        model=GROQ_MODEL,
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
            "result": json.loads(a.result) if isinstance(a.result, str) else a.result
        } for a in analyses
    ]}

@app.post("/send-interview-report")
async def send_interview_report(
    data: InterviewReportRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"📋 Placement Assessment Report: {data.name} ({data.branch})"
        msg["From"] = GMAIL_USER
        msg["To"] = GMAIL_USER 

        html = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; background-color: #0d0d13; color: #ffffff; border-radius: 16px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <h2 style="color: #F59E0B; border-bottom: 2px solid #F59E0B; padding-bottom: 10px; margin-top: 0; font-weight: 800;">ResumeAI Institutional Report</h2>
            <p style="color: #888; font-size: 14px;">The student has exited the AI Mock Interview simulation dashboard framework. Detailed metrics breakdown captured below:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #F59E0B; width: 35%;">Student Name:</td>
                    <td style="padding: 12px; color: #fff;">{data.name}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #F59E0B;">Email Identity:</td>
                    <td style="padding: 12px; color: #fff;">{data.email}</td>
                </tr>
                <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #F59E0B;">Age Matrix:</td>
                    <td style="padding: 12px; color: #fff;">{data.age} Years</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: #F59E0B;">Academic Branch:</td>
                    <td style="padding: 12px; color: #fff; text-transform: uppercase; letter-spacing: 1px;">{data.branch}</td>
                </tr>
            </table>
            <h3 style="color: #fff; margin-top: 30px; margin-bottom: 12px; font-size: 15px; border-left: 3px solid #F59E0B; padding-left: 8px;">Full Session Interaction History Logs:</h3>
            <div style="background: #050508; border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 10px; font-family: monospace; font-size: 12px; line-height: 1.6; color: #ccc; max-height: 400px; overflow-y: auto; white-space: pre-wrap;">{data.chat_history}</div>
            <p style="color: #444; font-size: 11px; margin-top: 30px; text-align: center;">Automated cloud placement pipeline dashboard telemetry data stream.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, GMAIL_USER, msg.as_string())
        
        return {"status": "success", "message": "Institutional placement assessment data metrics dispatched."}
    except Exception as e:
        print(f"Report Mail Critical Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal mail delivery systems timed out.")

@app.post("/auth/google")
def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

        try:
            idinfo = id_token.verify_oauth2_token(data.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        except Exception as token_err:
            print(f"GOOGLE TOKEN VERIFICATION CRASH -> {str(token_err)}")
            raise HTTPException(status_code=400, detail=f"Token validation failed: {str(token_err)}")
        
        user_email = idinfo.get('email')
        user_name = idinfo.get('name', 'Google User')
        
        if not user_email:
            raise HTTPException(status_code=400, detail="Google token account has no email parameters attached.")
            
        try:
            user = db.query(User).filter(User.email == user_email).first()
            
            if not user:
                user = User(
                    name=user_name,
                    email=user_email,
                    hashed_password=hash_password(f"google_pass_secure_{random.randint(1000, 9999)}"),
                    plan="free",
                    usage_count=0,
                    analysis_limit=2
                )
                user.is_verified = True
                db.add(user)
                db.commit()
                db.refresh(user)
        except Exception as db_err:
            print(f"DATABASE TRANSITION OPERATION CRASH -> {str(db_err)}")
            raise HTTPException(status_code=500, detail=f"Database state synchronization failed: {str(db_err)}")
        
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
        
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        print(f"CRITICAL GOOGLE AUTH ROOT PIPELINE CRASH -> {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Pipeline Mismatch: {str(e)}")