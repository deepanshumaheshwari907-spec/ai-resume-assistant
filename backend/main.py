from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db, User, Resume, ResumeAnalysis, JobOpportunity, OpportunityActivity, create_tables
from auth import hash_password, verify_password, create_token, get_current_user, verify_admin
import pdfplumber
import tempfile
import json
import os
import re
import random
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
#from dotenv import load_dotenv
from openai_service import analyze_resume, rewrite_resume, match_job, generate_cover_letter, interview_turn, generate_application_prep, tailor_resume

# --- GOOGLE AUTH PACKAGES ---
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

#load_dotenv()

app = FastAPI()

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_PASS = os.getenv("GMAIL_PASS", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

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
        print(f"[DEV OTP] {target_email} -> {otp_code}")
        return 
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your ResumeAI Account ðŸŽ‰"
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

# RESUMEAI_TIMELINE_V1
def record_opportunity_activity(
    db: Session,
    opportunity: JobOpportunity,
    event_type: str,
    title: str,
    details: str | None = None,
):
    db.add(
        OpportunityActivity(
            opportunity_id=opportunity.id,
            user_id=opportunity.user_id,
            event_type=event_type,
            title=title,
            details=(details or "").strip()[:5000] or None,
        )
    )


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


class OpportunityCreateRequest(BaseModel):
    company_name: str
    job_title: str
    job_description: str


class OpportunityStatusRequest(BaseModel):
    status: str


# RESUMEAI_APPLICATION_META_V1
class OpportunityMetadataRequest(BaseModel):
    application_deadline: datetime | None = None
    follow_up_at: datetime | None = None
    notes: str | None = None
    source_url: str | None = None

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
        analysis_limit=20,
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


async def resolve_resume_text(
    file: UploadFile | None,
    resume_id: int | None,
    current_user: User,
    db: Session,
) -> str:
    """Resolve resume text from a fresh PDF upload or the user's saved resume."""
    if resume_id is not None:
        resume = (
            db.query(Resume)
            .filter(
                Resume.id == resume_id,
                Resume.user_id == current_user.id,
                Resume.is_active == True,
            )
            .first()
        )
        if not resume:
            raise HTTPException(status_code=404, detail="Saved resume not found.")
        return (resume.content or "").strip()

    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="Upload a resume or select your saved resume.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    raw_file = await file.read()
    if len(raw_file) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume PDF must be 10 MB or smaller.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(raw_file)
            tmp_path = tmp.name

        resume_text = extract_text(tmp_path).strip()
        if len(resume_text) < 80:
            raise HTTPException(
                status_code=400,
                detail="We could not extract enough text from this PDF. Try a text-based PDF instead of a scanned image.",
            )
        return resume_text
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    job_role: str = Form("Software Engineer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    if current_user.usage_count >= current_user.analysis_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Free analysis limit reached ({current_user.analysis_limit}). Upgrade or wait for the next plan period.",
        )

    raw_file = await file.read()
    if len(raw_file) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume PDF must be 10 MB or smaller.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(raw_file)
            tmp_path = tmp.name

        resume_text = extract_text(tmp_path).strip()
        if len(resume_text) < 80:
            raise HTTPException(
                status_code=400,
                detail="We could not extract enough text from this PDF. Try a text-based PDF instead of a scanned image.",
            )

        # Make the newly uploaded resume the user's active resume.
        db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True,
        ).update({"is_active": False})

        resume = Resume(
            user_id=current_user.id,
            filename=file.filename,
            content=resume_text,
            is_active=True,
        )
        db.add(resume)
        db.flush()

        role = job_role.strip()[:200] or "Software Engineer"
        result = analyze_resume(resume_text, role)

        analysis = ResumeAnalysis(
            user_id=current_user.id,
            job_role=role,
            score=int(result["score"]),
            result=json.dumps(result),
        )
        db.add(analysis)
        current_user.usage_count += 1
        db.commit()

        return {"result": result}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Resume analysis error: {exc}")
        raise HTTPException(status_code=502, detail="Resume analysis service failed. Please try again.")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.get("/resume/latest")
def get_latest_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = (
        db.query(Resume)
        .filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True,
        )
        .order_by(Resume.created_at.desc())
        .first()
    )

    if not resume:
        return {"resume": None}

    return {
        "resume": {
            "id": resume.id,
            "filename": resume.filename,
            "created_at": str(resume.created_at),
            "is_active": resume.is_active,
        }
    }

@app.post("/analyze-saved-resume")
async def analyze_saved_resume(
    resume_id: int = Form(...),
    job_role: str = Form("Software Engineer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.usage_count >= current_user.analysis_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Free analysis limit reached ({current_user.analysis_limit}). Upgrade or wait for the next plan period.",
        )

    resume_text = await resolve_resume_text(None, resume_id, current_user, db)
    role = job_role.strip()[:200] or "Software Engineer"

    try:
        result = analyze_resume(resume_text, role)
        analysis = ResumeAnalysis(
            user_id=current_user.id,
            job_role=role,
            score=int(result["score"]),
            result=json.dumps(result),
        )
        db.add(analysis)
        current_user.usage_count += 1
        db.commit()
        return {"result": result}
    except Exception as exc:
        db.rollback()
        print(f"Saved resume analysis error: {exc}")
        raise HTTPException(status_code=502, detail="Resume analysis service failed. Please try again.")


@app.post("/rewrite")
async def rewrite_resume_endpoint(
    file: UploadFile | None = File(None),
    resume_id: int | None = Form(None),
    job_role: str = Form("Software Engineer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        resume_text = await resolve_resume_text(file, resume_id, current_user, db)
        rewritten = rewrite_resume(
            resume_text,
            job_role.strip()[:200] or "Software Engineer",
        )
        return {"rewritten_resume": rewritten}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Resume rewrite error: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Resume rewrite service failed. Please try again.",
        )


@app.post("/chat")
async def chat(data: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        if data.answer.strip().lower() == "start interview":
            return {
                "feedback": "Let's begin. Keep answers concise and use examples from your projects.",
                "next_question": "Tell me about yourself, your primary technical stack, and one technical project you built recently.",
            }
        result = interview_turn(data.answer.strip(), data.history.strip())
        return result
    except Exception as exc:
        print(f"Interview pipeline error: {exc}")
        raise HTTPException(status_code=502, detail="Interview AI service failed. Please try again.")

@app.post("/match-jd")
async def match_jd(
    file: UploadFile | None = File(None),
    resume_id: int | None = Form(None),
    job_description: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    try:
        resume_text = await resolve_resume_text(file, resume_id, current_user, db)
        result = match_job(resume_text, job_description.strip()[:30000])
        return {"result": result}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"JD matching error: {exc}")
        raise HTTPException(
            status_code=502,
            detail="JD matching service failed. Please try again.",
        )


@app.post("/cover-letter")
async def generate_cover_letter_endpoint(
    file: UploadFile | None = File(None),
    resume_id: int | None = Form(None),
    job_role: str = Form(...),
    company_name: str = Form("the company"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        resume_text = await resolve_resume_text(file, resume_id, current_user, db)
        letter = generate_cover_letter(
            resume_text,
            job_role.strip()[:200] or "Software Engineer",
            company_name.strip()[:200] or "the company",
        )
        return {"cover_letter": letter}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Cover letter error: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Cover letter generation failed. Please try again.",
        )


@app.post("/opportunities")
async def create_opportunity(
    data: OpportunityCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_name = data.company_name.strip()[:200]
    job_title = data.job_title.strip()[:200]
    job_description = data.job_description.strip()[:30000]

    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required.")
    if not job_title:
        raise HTTPException(status_code=400, detail="Job title is required.")
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    opportunity = JobOpportunity(
        user_id=current_user.id,
        company_name=company_name,
        job_title=job_title,
        job_description=job_description,
        status="saved",
    )
    db.add(opportunity)
    db.flush()

    record_opportunity_activity(
        db,
        opportunity,
        "created",
        "Opportunity saved",
        f"{opportunity.job_title} at {opportunity.company_name}",
    )

    db.commit()
    db.refresh(opportunity)

    return {
        "opportunity": {
            "id": opportunity.id,
            "company_name": opportunity.company_name,
            "job_title": opportunity.job_title,
            "status": opportunity.status,
            "match_score": opportunity.match_score,
            "created_at": str(opportunity.created_at),
            "updated_at": str(opportunity.updated_at or opportunity.created_at),
        }
    }


@app.get("/opportunities")
async def list_opportunities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunities = (
        db.query(JobOpportunity)
        .filter(JobOpportunity.user_id == current_user.id)
        .order_by(JobOpportunity.updated_at.desc(), JobOpportunity.id.desc())
        .limit(50)
        .all()
    )

    return {
        "opportunities": [
            {
                "id": item.id,
                "company_name": item.company_name,
                "job_title": item.job_title,
                "status": item.status,
                "match_score": item.match_score,
                "application_deadline": item.application_deadline.isoformat() if item.application_deadline else None,
                "applied_at": item.applied_at.isoformat() if item.applied_at else None,
                "follow_up_at": item.follow_up_at.isoformat() if item.follow_up_at else None,
                "notes": item.notes,
                "source_url": item.source_url,
                "created_at": str(item.created_at),
                "updated_at": str(item.updated_at or item.created_at),
            }
            for item in opportunities
        ]
    }


@app.get("/opportunities/{opportunity_id}")
async def get_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    return {
        "opportunity": {
            "id": opportunity.id,
            "company_name": opportunity.company_name,
            "job_title": opportunity.job_title,
            "job_description": opportunity.job_description,
            "status": opportunity.status,
            "match_score": opportunity.match_score,
            "match_result": json.loads(opportunity.match_result) if opportunity.match_result else None,
            "tailored_resume": opportunity.tailored_resume,
            "cover_letter": opportunity.cover_letter,
            "application_pack": json.loads(opportunity.application_pack) if opportunity.application_pack else None,
            "application_deadline": opportunity.application_deadline.isoformat() if opportunity.application_deadline else None,
            "applied_at": opportunity.applied_at.isoformat() if opportunity.applied_at else None,
            "follow_up_at": opportunity.follow_up_at.isoformat() if opportunity.follow_up_at else None,
            "notes": opportunity.notes,
            "source_url": opportunity.source_url,
            "created_at": str(opportunity.created_at),
            "updated_at": str(opportunity.updated_at or opportunity.created_at),
        }
    }


@app.patch("/opportunities/{opportunity_id}/status")
async def update_opportunity_status(
    opportunity_id: int,
    data: OpportunityStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = {"saved", "analyzed", "tailored", "applied", "interview", "offer", "closed"}
    new_status = data.status.strip().lower()
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Use one of: {', '.join(sorted(allowed))}.",
        )

    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    previous_status = opportunity.status
    opportunity.status = new_status

    # RESUMEAI_APPLICATION_META_V1
    # Record the first time the application reaches an application-stage status.
    if new_status in {"applied", "interview", "offer"} and opportunity.applied_at is None:
        opportunity.applied_at = datetime.utcnow()

    # RESUMEAI_TIMELINE_V1
    if previous_status != new_status:
        record_opportunity_activity(
            db,
            opportunity,
            "status",
            f"Status moved to {new_status.title()}",
            f"{previous_status.title()} -> {new_status.title()}",
        )

    db.commit()
    db.refresh(opportunity)

    return {
        "message": "Opportunity status updated.",
        "opportunity": {
            "id": opportunity.id,
            "status": opportunity.status,
            "updated_at": str(opportunity.updated_at or opportunity.created_at),
        },
    }



# RESUMEAI_APPLICATION_META_V1
@app.patch("/opportunities/{opportunity_id}/metadata")
async def update_opportunity_metadata(
    opportunity_id: int,
    data: OpportunityMetadataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    changed_fields = []

    if data.application_deadline is not None:
        opportunity.application_deadline = data.application_deadline
        changed_fields.append("deadline")
    if data.follow_up_at is not None:
        opportunity.follow_up_at = data.follow_up_at
        changed_fields.append("follow-up")
    if data.notes is not None:
        opportunity.notes = data.notes.strip()[:10000] or None
        changed_fields.append("notes")
    if data.source_url is not None:
        opportunity.source_url = data.source_url.strip()[:2000] or None
        changed_fields.append("source")

    # RESUMEAI_TIMELINE_V1
    if changed_fields:
        record_opportunity_activity(
            db,
            opportunity,
            "details",
            "Application details updated",
            "Updated: " + ", ".join(changed_fields),
        )

    db.commit()
    db.refresh(opportunity)

    return {
        "message": "Application metadata updated.",
        "opportunity": {
            "id": opportunity.id,
            "application_deadline": opportunity.application_deadline.isoformat() if opportunity.application_deadline else None,
            "applied_at": opportunity.applied_at.isoformat() if opportunity.applied_at else None,
            "follow_up_at": opportunity.follow_up_at.isoformat() if opportunity.follow_up_at else None,
            "notes": opportunity.notes,
            "source_url": opportunity.source_url,
            "updated_at": str(opportunity.updated_at or opportunity.created_at),
        },
    }


# RESUMEAI_TIMELINE_V1
@app.get("/opportunities/{opportunity_id}/activity")
async def get_opportunity_activity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    activities = (
        db.query(OpportunityActivity)
        .filter(
            OpportunityActivity.opportunity_id == opportunity_id,
            OpportunityActivity.user_id == current_user.id,
        )
        .order_by(
            OpportunityActivity.created_at.desc(),
            OpportunityActivity.id.desc(),
        )
        .limit(100)
        .all()
    )

    return {
        "activities": [
            {
                "id": item.id,
                "event_type": item.event_type,
                "title": item.title,
                "details": item.details,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in activities
        ]
    }


# RESUMEAI_ANALYTICS_V1
@app.get("/opportunities/analytics/summary")
async def get_opportunity_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return tracker-level analytics derived from the user's opportunities."""
    opportunities = (
        db.query(JobOpportunity)
        .filter(JobOpportunity.user_id == current_user.id)
        .order_by(JobOpportunity.updated_at.desc(), JobOpportunity.id.desc())
        .all()
    )

    stage_order = ["saved", "analyzed", "tailored", "applied", "interview", "offer", "closed"]
    stage_counts = {stage: 0 for stage in stage_order}
    for opportunity in opportunities:
        stage = (opportunity.status or "saved").strip().lower()
        if stage not in stage_counts:
            stage_counts[stage] = 0
        stage_counts[stage] += 1

    total_opportunities = len(opportunities)
    submitted = [
        opportunity
        for opportunity in opportunities
        if opportunity.applied_at is not None
        or (opportunity.status or "").strip().lower() in {"applied", "interview", "offer"}
    ]
    submitted_count = len(submitted)
    interview_count = stage_counts.get("interview", 0)
    offer_count = stage_counts.get("offer", 0)
    response_count = interview_count + offer_count
    response_rate = round((response_count / submitted_count) * 100, 1) if submitted_count else 0.0

    scored = [
        int(opportunity.match_score)
        for opportunity in opportunities
        if opportunity.match_score is not None
    ]
    average_match_score = round(sum(scored) / len(scored), 1) if scored else None

    now = datetime.utcnow()
    action_items = []

    for opportunity in opportunities:
        if opportunity.application_deadline:
            delta_days = (opportunity.application_deadline - now).total_seconds() / 86400
            action_items.append({
                "type": "deadline",
                "opportunity_id": opportunity.id,
                "company_name": opportunity.company_name,
                "job_title": opportunity.job_title,
                "date": opportunity.application_deadline.isoformat(),
                "days_delta": round(delta_days, 1),
                "overdue": delta_days < 0,
            })

        if opportunity.follow_up_at:
            delta_days = (opportunity.follow_up_at - now).total_seconds() / 86400
            action_items.append({
                "type": "follow_up",
                "opportunity_id": opportunity.id,
                "company_name": opportunity.company_name,
                "job_title": opportunity.job_title,
                "date": opportunity.follow_up_at.isoformat(),
                "days_delta": round(delta_days, 1),
                "overdue": delta_days < 0,
            })

    action_items.sort(
        key=lambda item: (
            0 if item["overdue"] else 1,
            abs(item["days_delta"]) if item["overdue"] else item["days_delta"],
        )
    )

    return {
        "analytics": {
            "total_opportunities": total_opportunities,
            "submitted_count": submitted_count,
            "interview_count": interview_count,
            "offer_count": offer_count,
            "response_count": response_count,
            "response_rate": response_rate,
            "average_match_score": average_match_score,
            "stage_counts": stage_counts,
            "upcoming_actions": action_items[:8],
        }
    }


@app.post("/opportunities/{opportunity_id}/prepare-application")
async def prepare_application(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    resume = db.query(Resume).filter(
        Resume.user_id == current_user.id,
        Resume.is_active == True,
    ).order_by(Resume.created_at.desc()).first()

    if not resume:
        raise HTTPException(status_code=400, detail="Upload a resume before preparing the application.")

    try:
        # Reuse previously saved assets when possible to avoid duplicate generation.
        if opportunity.match_result:
            match_result = json.loads(opportunity.match_result)
        else:
            match_result = match_job(resume.content, opportunity.job_description)

        tailored_resume_model = None
        if opportunity.tailored_resume:
            try:
                existing_tailored = json.loads(opportunity.tailored_resume)
                if (
                    isinstance(existing_tailored, dict)
                    and existing_tailored.get("format_version") == 1
                ):
                    tailored_resume_model = existing_tailored
            except (TypeError, ValueError):
                tailored_resume_model = None

        if tailored_resume_model is None:
            tailored_resume_model = tailor_resume(
                resume.content,
                opportunity.job_title,
                opportunity.job_description,
            )

        tailored_resume = json.dumps(
            tailored_resume_model,
            ensure_ascii=False,
        )

        cover_letter = opportunity.cover_letter or generate_cover_letter(
            resume.content,
            opportunity.job_title,
            opportunity.company_name,
        )

        existing_pack = json.loads(opportunity.application_pack) if opportunity.application_pack else None
        interview_prep = (
            existing_pack.get("interview_prep")
            if isinstance(existing_pack, dict)
            else None
        )

        if not interview_prep:
            interview_prep = generate_application_prep(
                resume.content,
                opportunity.job_title,
                opportunity.company_name,
                opportunity.job_description,
            )

        application_pack = {
            "match_result": match_result,
            "tailored_resume": tailored_resume_model,
            "cover_letter": cover_letter,
            "interview_prep": interview_prep,
            "prepared_for": {
                "company_name": opportunity.company_name,
                "job_title": opportunity.job_title,
            },
        }

        opportunity.match_score = int(match_result.get("match_score", opportunity.match_score or 0))
        opportunity.match_result = json.dumps(match_result)
        opportunity.tailored_resume = tailored_resume
        opportunity.cover_letter = cover_letter
        opportunity.application_pack = json.dumps(application_pack)
        # RESUMEAI_WORKSPACE_V2_HOTFIX: never move an application backwards in the pipeline.
        if opportunity.status in {"saved", "analyzed"}:
            opportunity.status = "tailored"

        # RESUMEAI_TIMELINE_V1
        record_opportunity_activity(
            db,
            opportunity,
            "prepared",
            "Application pack prepared",
            "Application assets and interview preparation were saved.",
        )

        db.commit()
        db.refresh(opportunity)

        return {
            "opportunity": {
                "id": opportunity.id,
                "status": opportunity.status,
                "match_score": opportunity.match_score,
                "match_result": match_result,
                "tailored_resume": tailored_resume,
                "cover_letter": cover_letter,
                "application_pack": application_pack,
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Application pack error: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Application preparation failed. Please try again.",
        )


@app.delete("/opportunities/{opportunity_id}")
async def delete_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()

    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    db.query(OpportunityActivity).filter(
        OpportunityActivity.opportunity_id == opportunity_id,
        OpportunityActivity.user_id == current_user.id,
    ).delete(synchronize_session=False)

    db.delete(opportunity)
    db.commit()
    return {"message": "Opportunity deleted."}



@app.post("/opportunities/{opportunity_id}/match")
async def match_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    try:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True,
        ).order_by(Resume.created_at.desc()).first()
        if not resume:
            raise HTTPException(status_code=400, detail="Upload a resume before matching this opportunity.")

        result = match_job(resume.content, opportunity.job_description)
        opportunity.match_score = int(result.get("match_score", 0))
        opportunity.match_result = json.dumps(result)
        opportunity.status = "analyzed"

        # RESUMEAI_TIMELINE_V1
        record_opportunity_activity(
            db,
            opportunity,
            "match",
            "Job match analyzed",
            f"Saved match score: {opportunity.match_score}%",
        )

        db.commit()
        db.refresh(opportunity)
        return {"opportunity": {"id": opportunity.id, "status": opportunity.status, "match_score": opportunity.match_score, "match_result": result}}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Opportunity match error: {exc}")
        raise HTTPException(status_code=502, detail="Opportunity matching failed. Please try again.")


@app.post("/opportunities/{opportunity_id}/tailor")
async def tailor_opportunity(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    try:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True,
        ).order_by(Resume.created_at.desc()).first()
        if not resume:
            raise HTTPException(status_code=400, detail="Upload a resume before tailoring it.")

        tailored = tailor_resume(
            resume.content,
            opportunity.job_title,
            opportunity.job_description,
        )
        opportunity.tailored_resume = json.dumps(
            tailored,
            ensure_ascii=False,
        )
        opportunity.status = "tailored"

        # RESUMEAI_TIMELINE_V1
        record_opportunity_activity(
            db,
            opportunity,
            "tailor",
            "Resume tailored",
            "A role-specific resume draft was generated and saved.",
        )

        db.commit()
        db.refresh(opportunity)
        return {"opportunity": {"id": opportunity.id, "status": opportunity.status, "tailored_resume": opportunity.tailored_resume}}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Opportunity tailor error: {exc}")
        raise HTTPException(status_code=502, detail="Resume tailoring failed. Please try again.")


@app.post("/opportunities/{opportunity_id}/cover-letter")
async def opportunity_cover_letter(
    opportunity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    opportunity = db.query(JobOpportunity).filter(
        JobOpportunity.id == opportunity_id,
        JobOpportunity.user_id == current_user.id,
    ).first()
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    try:
        resume = db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.is_active == True,
        ).order_by(Resume.created_at.desc()).first()
        if not resume:
            raise HTTPException(status_code=400, detail="Upload a resume before generating a cover letter.")

        letter = generate_cover_letter(
            resume.content,
            opportunity.job_title,
            opportunity.company_name,
            opportunity.job_description,
        )
        opportunity.cover_letter = letter
        if opportunity.status == "saved":
            opportunity.status = "analyzed"

        # RESUMEAI_TIMELINE_V1
        record_opportunity_activity(
            db,
            opportunity,
            "cover",
            "Cover letter generated",
            "A job-specific cover letter was generated and saved.",
        )

        db.commit()
        db.refresh(opportunity)
        return {"opportunity": {"id": opportunity.id, "status": opportunity.status, "cover_letter": opportunity.cover_letter}}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Opportunity cover letter error: {exc}")
        raise HTTPException(status_code=502, detail="Cover letter generation failed. Please try again.")

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
        msg["Subject"] = f"ðŸ“‹ Placement Assessment Report: {data.name} ({data.branch})"
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
            print(f"DATABASE TRANSITION OPERATIONCRASH -> {str(db_err)}")
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