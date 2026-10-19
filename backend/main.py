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
import requests

import random

import secrets

import hmac

import hashlib
import html as html_lib

from datetime import datetime, timedelta

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
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "").strip()

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


def record_opportunity_activity(
    db: Session,
    opportunity: JobOpportunity,
    event_type: str,
    title: str,
    details: str | None = None,
) -> None:
    """Queue an activity timeline event in the current database transaction.

    The endpoint commits the opportunity and this event together, so callers
    should not commit inside this helper.
    """
    db.add(
        OpportunityActivity(
            opportunity_id=opportunity.id,
            user_id=opportunity.user_id,
            event_type=(event_type or "activity").strip()[:80],
            title=(title or "Activity").strip()[:200],
            details=(details or "").strip()[:5000] or None,
        )
    )




# Local Helper Function to send Email via Python smtplib (Airtight & Dependency-free)













def _build_auth_otp_email(purpose: str, otp_code: str):
    """Build consistent plain-text and HTML content for authentication OTP email."""
    if purpose == "signup":
        context_label = "ACCOUNT VERIFICATION"
        heading = "Verify your email"
        intro = "Use this one-time code to verify your email and activate your ResumeAI account."
        security_note = "If you did not try to create an account, you can safely ignore this email."
    elif purpose == "password_reset":
        context_label = "ACCOUNT SECURITY"
        heading = "Reset your password"
        intro = "Use this one-time code to continue resetting the password for your ResumeAI account."
        security_note = "If you did not request a password reset, you can safely ignore this email."
    else:
        raise ValueError("Unsupported authentication email purpose.")

    expiry_minutes = max(1, (OTP_TTL_SECONDS + 59) // 60)
    safe_code = html_lib.escape(str(otp_code))
    plain_text = (
        f"ResumeAI - {heading}\n\n"
        f"{intro}\n\n"
        f"Your one-time code: {otp_code}\n"
        f"This code expires in {expiry_minutes} minutes.\n\n"
        f"Never share this code with anyone. {security_note}\n"
    )
    html_body = f"""<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f1f2f5;">
    <div style="padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#f6f7f9;">
      <div style="max-width:560px;margin:0 auto;background:#0a0b10;border:1px solid #272a33;border-radius:16px;overflow:hidden;">
        <div style="height:4px;background:#e0231c;font-size:0;line-height:0;">&nbsp;</div>
        <div style="padding:28px;">
          <div style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin-bottom:24px;color:#ffffff;">Resume<span style="color:#e0231c;">AI</span></div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1.8px;color:#9ca3af;margin-bottom:10px;">{context_label}</div>
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;color:#ffffff;">{heading}</h1>
          <p style="font-size:15px;line-height:1.65;color:#b9bec8;margin:0 0 24px;">{intro}</p>
          <div style="background:#11131a;border:1px solid #30343d;border-radius:14px;padding:20px 16px;margin:0 0 20px;text-align:center;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.8px;color:#9299a6;margin-bottom:12px;">YOUR ONE-TIME CODE</div>
            <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#ffffff;">{safe_code}</div>
          </div>
          <p style="font-size:13px;line-height:1.6;color:#a2a8b4;margin:0 0 10px;">This code expires in <strong style="color:#f6f7f9;">{expiry_minutes} minutes</strong>.</p>
          <p style="font-size:13px;line-height:1.65;color:#a2a8b4;margin:0;">Never share this code with anyone. {security_note}</p>
          <div style="margin-top:28px;padding-top:16px;border-top:1px solid #272a33;font-size:12px;line-height:1.6;color:#747b87;">&copy; {datetime.now().year} ResumeAI <span style="padding:0 5px;">&bull;</span> Secure account access</div>
        </div>
      </div>
    </div>
  </body>
</html>
"""
    return plain_text, html_body



def _send_auth_email_via_brevo(
    target_email: str,
    subject: str,
    purpose: str,
    otp_code: str,
) -> None:
    """Send an authentication OTP with Brevo HTTPS API or local Gmail SMTP fallback.

    Render Free blocks outbound SMTP ports. When BREVO_API_KEY is configured,
    use Brevo's HTTPS API; SMTP remains available only for local development.
    Never log recipient addresses, OTPs, API keys, or provider response bodies.
    """
    plain_text, html_body = _build_auth_otp_email(purpose, otp_code)

    if BREVO_API_KEY:
        if not BREVO_SENDER_EMAIL:
            raise RuntimeError(
                "Email delivery is not configured. Set BREVO_SENDER_EMAIL in the backend environment."
            )

        payload = {
            "sender": {"name": "ResumeAI", "email": BREVO_SENDER_EMAIL},
            "to": [{"email": target_email}],
            "subject": subject,
            "htmlContent": html_body,
            "textContent": plain_text,
        }
        headers = {
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
        }
        try:
            response = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                headers=headers,
                json=payload,
                timeout=15,
            )
        except requests.RequestException as exc:
            print(f"Brevo email delivery failed: {type(exc).__name__}")
            raise RuntimeError(
                "We could not deliver the verification email. Please try again shortly."
            ) from exc

        if not 200 <= response.status_code < 300:
            print(f"Brevo email delivery failed: HTTP {response.status_code}")
            raise RuntimeError(
                "We could not deliver the verification email. Please try again shortly."
            )
        return

    # Local-development fallback. On Render, set BREVO_API_KEY so this SMTP
    # path is not used on the Free instance.
    if not GMAIL_USER or not GMAIL_PASS:
        raise RuntimeError(
            "Email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL, "
            "or configure GMAIL_USER and GMAIL_PASS for local SMTP development."
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ResumeAI <{GMAIL_USER}>"
    msg["To"] = target_email
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, target_email, msg.as_string())
    except Exception as exc:
        print(f"SMTP delivery failed: {type(exc).__name__}")
        raise RuntimeError(
            "We could not deliver the verification email. Please try again shortly."
        ) from exc


def send_otp_email(target_email: str, otp_code: str):
    """Send the signup verification OTP using the configured email provider."""
    _send_auth_email_via_brevo(
        target_email,
        "Your ResumeAI verification code",
        "signup",
        otp_code,
    )



OTP_TTL_SECONDS = max(60, int(os.getenv("OTP_TTL_SECONDS", "600")))

OTP_MAX_ATTEMPTS = max(1, int(os.getenv("OTP_MAX_ATTEMPTS", "5")))

OTP_RESEND_COOLDOWN_SECONDS = max(15, int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60")))

OTP_MAX_SENDS = max(1, int(os.getenv("OTP_MAX_SENDS", "5")))

OTP_SEND_WINDOW_SECONDS = max(300, int(os.getenv("OTP_SEND_WINDOW_SECONDS", "900")))





def _utcnow():

    return datetime.utcnow()





def _otp_hash(code: str, salt: str) -> str:

    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()





def _new_otp_record(sent_count=1, window_started=None):

    code = f"{secrets.randbelow(1_000_000):06d}"

    salt = secrets.token_hex(16)

    now = _utcnow()

    window_started = window_started or now

    return ({

        "v": 1,

        "hash": _otp_hash(code, salt),

        "salt": salt,

        "issued_at": now.isoformat(),

        "expires_at": (now + timedelta(seconds=OTP_TTL_SECONDS)).isoformat(),

        "attempts": 0,

        "last_sent_at": now.isoformat(),

        "sent_count": sent_count,

        "window_started_at": window_started.isoformat(),

    }, code)





def _load_otp_record(raw):

    if not raw:

        return None

    try:

        value = json.loads(raw)

    except Exception:

        return None

    return value if isinstance(value, dict) and value.get("v") == 1 else None





def _record_status(record):

    if not record:

        return "missing"

    try:

        expires_at = datetime.fromisoformat(record["expires_at"])

    except Exception:

        return "invalid"

    if _utcnow() >= expires_at:

        return "expired"

    if int(record.get("attempts", 0)) >= OTP_MAX_ATTEMPTS:

        return "locked"

    return "active"





def _check_resend_limit(record):

    if not record:

        return None, None

    try:

        now = _utcnow()

        window_started = datetime.fromisoformat(record["window_started_at"])

        last_sent = datetime.fromisoformat(record["last_sent_at"])

    except Exception:

        return None, None

    if (now - window_started).total_seconds() >= OTP_SEND_WINDOW_SECONDS:

        return 0, now

    cooldown_left = OTP_RESEND_COOLDOWN_SECONDS - int((now - last_sent).total_seconds())

    if cooldown_left > 0:

        raise HTTPException(status_code=429, detail=f"Please wait {cooldown_left}s before requesting another code.")

    sent_count = int(record.get("sent_count", 0))

    if sent_count >= OTP_MAX_SENDS:

        raise HTTPException(status_code=429, detail="Too many verification emails requested. Please try again later.")

    return sent_count, window_started





def _persist_otp(user, record):

    user.otp_code = json.dumps(record, separators=(",", ":"))





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





class PasswordResetRequest(BaseModel):

    email: EmailStr





class PasswordResetVerifyRequest(BaseModel):

    email: EmailStr

    otp: str





class PasswordResetCompleteRequest(BaseModel):

    email: EmailStr

    reset_token: str

    new_password: str





class ChangePasswordRequest(BaseModel):

    current_password: str

    new_password: str



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

    email = data.email.strip().lower()

    existing = db.query(User).filter(User.email == email).first()

    if existing:

        raise HTTPException(status_code=400, detail="Email already registered")

    if len(data.name.strip()) < 2:

        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")

    if len(data.password) < 6:

        raise HTTPException(status_code=400, detail="Password must contain at least 6 characters")



    otp_record, otp_code = _new_otp_record()

    try:

        send_otp_email(email, otp_code)

    except RuntimeError as exc:

        raise HTTPException(status_code=503, detail=str(exc))



    user = User(

        name=data.name.strip(), email=email,

        hashed_password=hash_password(data.password),

        plan="free", usage_count=0, analysis_limit=20,

        is_verified=False,

    )

    _persist_otp(user, otp_record)

    db.add(user)

    db.commit()

    return {"message": "Verification code sent to your email address.", "email": user.email, "expires_in": OTP_TTL_SECONDS}





@app.post("/auth/verify-otp")

def verify_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user:

        raise HTTPException(status_code=400, detail="Invalid or expired verification request.")

    if user.is_verified:

        raise HTTPException(status_code=400, detail="This account is already verified. Please sign in.")



    record = _load_otp_record(getattr(user, "otp_code", None))

    status_value = _record_status(record)

    if status_value == "expired":

        user.otp_code = None

        db.commit()

        raise HTTPException(status_code=410, detail="This verification code has expired. Request a new one.")

    if status_value == "locked":

        raise HTTPException(status_code=429, detail="Too many incorrect verification attempts. Request a new code.")

    if status_value != "active":

        raise HTTPException(status_code=400, detail="Invalid or expired verification request.")



    expected = _otp_hash(data.otp.strip(), record["salt"])

    if not hmac.compare_digest(expected, record["hash"]):

        record["attempts"] = int(record.get("attempts", 0)) + 1

        _persist_otp(user, record)

        db.commit()

        remaining = max(0, OTP_MAX_ATTEMPTS - record["attempts"])

        detail = "Invalid verification code."

        if remaining:

            detail += f" {remaining} attempt(s) remaining."

        else:

            detail += " Request a new code."

        raise HTTPException(status_code=400, detail=detail)



    user.is_verified = True

    user.otp_code = None

    db.commit()

    token = create_token({"user_id": user.id})

    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "plan": user.plan, "usage_count": user.usage_count, "analysis_limit": user.analysis_limit}}





@app.post("/auth/resend-otp")

def resend_otp(data: OTPVerifyRequest, db: Session = Depends(get_db)):

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user or user.is_verified:

        return {"message": "If the account needs verification, a new code has been sent."}



    existing = _load_otp_record(getattr(user, "otp_code", None))

    sent_count, window_started = _check_resend_limit(existing)

    next_count = 1 if sent_count is None else sent_count + 1

    otp_record, otp_code = _new_otp_record(sent_count=next_count, window_started=window_started)

    try:

        send_otp_email(email, otp_code)

    except RuntimeError as exc:

        raise HTTPException(status_code=503, detail=str(exc))

    _persist_otp(user, otp_record)

    db.commit()

    return {"message": "A new verification code has been sent.", "expires_in": OTP_TTL_SECONDS}





PASSWORD_RESET_TOKEN_TTL_SECONDS = max(300, int(os.getenv("PASSWORD_RESET_TOKEN_TTL_SECONDS", "600")))





def _password_reset_token_hash(token: str, salt: str) -> str:

    return hashlib.sha256(f"{salt}:{token}".encode("utf-8")).hexdigest()





def _validate_new_password(password: str) -> None:

    if len(password or "") < 8:

        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")





def send_password_reset_email(target_email: str, otp_code: str) -> None:
    """Send the password-reset OTP using the configured email provider."""
    _send_auth_email_via_brevo(
        target_email,
        "Your ResumeAI password reset code",
        "password_reset",
        otp_code,
    )



@app.post("/auth/forgot-password")

def forgot_password(data: PasswordResetRequest, db: Session = Depends(get_db)):

    """Start password recovery without revealing whether an account exists."""

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()



    if user and getattr(user, "is_verified", False):

        existing = _load_otp_record(getattr(user, "otp_code", None))

        if existing and existing.get("purpose") == "password_reset":

            try:

                sent_count, window_started = _check_resend_limit(existing)

            except HTTPException:

                return {"message": "If an account exists for this email, a password reset code has been sent."}

        else:

            sent_count, window_started = None, None



        next_count = 1 if sent_count is None else sent_count + 1

        otp_record, otp_code = _new_otp_record(

            sent_count=next_count,

            window_started=window_started,

        )

        otp_record["purpose"] = "password_reset"

        try:

            send_password_reset_email(email, otp_code)

        except RuntimeError as exc:

            cause = exc.__cause__
            failure_type = type(cause).__name__ if cause is not None else type(exc).__name__
            print(f"Password reset email delivery failed: {failure_type}")

            return {"message": "If an account exists for this email, a password reset code has been sent."}

        _persist_otp(user, otp_record)

        db.commit()



    return {"message": "If an account exists for this email, a password reset code has been sent."}





@app.post("/auth/verify-reset-otp")

def verify_reset_otp(data: PasswordResetVerifyRequest, db: Session = Depends(get_db)):

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user:

        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")



    record = _load_otp_record(getattr(user, "otp_code", None))

    if not record or record.get("purpose") != "password_reset":

        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    if record.get("reset_token_hash"):

        raise HTTPException(status_code=400, detail="Verification code has already been used.")



    status_value = _record_status(record)

    if status_value == "expired":

        user.otp_code = None

        db.commit()

        raise HTTPException(status_code=410, detail="Verification code has expired. Request a new one.")

    if status_value == "locked":

        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")

    if status_value != "active":

        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")



    expected = _otp_hash(data.otp.strip(), record["salt"])

    if not hmac.compare_digest(expected, record["hash"]):

        record["attempts"] = int(record.get("attempts", 0)) + 1

        _persist_otp(user, record)

        db.commit()

        remaining = max(0, OTP_MAX_ATTEMPTS - record["attempts"])

        detail = "Invalid verification code."

        if remaining:

            detail += f" {remaining} attempt(s) remaining."

        else:

            detail += " Request a new code."

        raise HTTPException(status_code=400, detail=detail)



    reset_token = secrets.token_urlsafe(32)

    record["reset_token_hash"] = _password_reset_token_hash(reset_token, record["salt"])

    record["reset_token_expires_at"] = (datetime.utcnow() + timedelta(seconds=PASSWORD_RESET_TOKEN_TTL_SECONDS)).isoformat()

    record.pop("hash", None)

    _persist_otp(user, record)

    db.commit()

    return {

        "message": "Verification successful. Create a new password.",

        "reset_token": reset_token,

        "expires_in": PASSWORD_RESET_TOKEN_TTL_SECONDS,

    }





@app.post("/auth/reset-password")

def reset_password(data: PasswordResetCompleteRequest, db: Session = Depends(get_db)):

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user:

        raise HTTPException(status_code=400, detail="Password reset session is invalid or expired.")



    record = _load_otp_record(getattr(user, "otp_code", None))

    if not record or record.get("purpose") != "password_reset":

        raise HTTPException(status_code=400, detail="Password reset session is invalid or expired.")



    token_hash = record.get("reset_token_hash")

    expires_raw = record.get("reset_token_expires_at")

    if not token_hash or not expires_raw:

        raise HTTPException(status_code=400, detail="Password reset session is invalid or expired.")



    if datetime.utcnow() >= datetime.fromisoformat(expires_raw):

        user.otp_code = None

        db.commit()

        raise HTTPException(status_code=400, detail="Password reset session has expired. Start again.")



    expected_hash = _password_reset_token_hash(data.reset_token, record["salt"])

    if not hmac.compare_digest(token_hash, expected_hash):

        raise HTTPException(status_code=400, detail="Password reset session is invalid or expired.")



    _validate_new_password(data.new_password)

    user.hashed_password = hash_password(data.new_password)

    user.otp_code = None

    db.commit()

    return {"message": "Password reset successfully. Please sign in again."}





@app.post("/auth/change-password")

def change_password(

    data: ChangePasswordRequest,

    current_user: User = Depends(get_current_user),

    db: Session = Depends(get_db),

):

    if not verify_password(data.current_password, current_user.hashed_password):

        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if data.current_password == data.new_password:

        raise HTTPException(status_code=400, detail="New password must be different from the current password.")



    _validate_new_password(data.new_password)

    current_user.hashed_password = hash_password(data.new_password)

    db.commit()

    return {"message": "Password changed successfully. Please sign in again."}





@app.post("/auth/login")

def login(data: LoginRequest, db: Session = Depends(get_db)):

    email = data.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.hashed_password):

        raise HTTPException(status_code=401, detail="Invalid email or password")



    if not getattr(user, "is_verified", True):

        existing = _load_otp_record(getattr(user, "otp_code", None))

        status_value = _record_status(existing)

        if status_value == "active":

            raise HTTPException(status_code=403, detail="Email verification required. Enter the verification code sent to your email.")

        sent_count, window_started = _check_resend_limit(existing)

        next_count = 1 if sent_count is None else sent_count + 1

        otp_record, otp_code = _new_otp_record(sent_count=next_count, window_started=window_started)

        try:

            send_otp_email(email, otp_code)

        except RuntimeError as exc:

            raise HTTPException(status_code=503, detail=str(exc))

        _persist_otp(user, otp_record)

        db.commit()

        raise HTTPException(status_code=403, detail="Email verification required. A verification code has been sent to your email.")



    token = create_token({"user_id": user.id})

    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "plan": user.plan, "usage_count": user.usage_count, "analysis_limit": user.analysis_limit}}





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



        existing_pack = json.loads(opportunity.application_pack) if opportunity.application_pack else {}

        if not isinstance(existing_pack, dict):

            existing_pack = {}



        # RESUMEAI_APPLICATION_PACK_COVER_CONTEXT_V1

        current_cover_context = {

            "company_name": opportunity.company_name,

            "job_title": opportunity.job_title,

        }

        saved_cover_context = existing_pack.get("cover_letter_context")



        cover_context_matches = (

            isinstance(saved_cover_context, dict)

            and str(saved_cover_context.get("company_name", "")).strip().lower()

                == str(current_cover_context["company_name"]).strip().lower()

            and str(saved_cover_context.get("job_title", "")).strip().lower()

                == str(current_cover_context["job_title"]).strip().lower()

        )



        if opportunity.cover_letter and cover_context_matches:

            cover_letter = opportunity.cover_letter

        else:

            # RESUMEAI_APPLICATION_PACK_COVER_JD_V1

            cover_letter = generate_cover_letter(

                resume.content,

                opportunity.job_title,

                opportunity.company_name,

                opportunity.job_description,

            )



        interview_prep = existing_pack.get("interview_prep")



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

            "cover_letter_context": current_cover_context,

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



        # RESUMEAI_TRACKER_STATUS_GUARD_V1

        if opportunity.status == "saved":

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



        # RESUMEAI_TRACKER_STATUS_GUARD_V1

        if opportunity.status in {"saved", "analyzed"}:

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



        # RESUMEAI_COVER_CONTEXT_V1

        existing_pack = json.loads(opportunity.application_pack) if opportunity.application_pack else {}

        if not isinstance(existing_pack, dict):

            existing_pack = {}

        existing_pack["cover_letter"] = letter

        existing_pack["cover_letter_context"] = {

            "company_name": opportunity.company_name,

            "job_title": opportunity.job_title,

        }

        opportunity.application_pack = json.dumps(existing_pack, ensure_ascii=False)



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