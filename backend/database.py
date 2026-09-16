from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resumeai.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    plan = Column(String, default="free")
    usage_count = Column(Integer, default=0)
    analysis_limit = Column(Integer, default=2)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_verified = Column(Boolean, default=False)
    otp_code = Column(String, nullable=True)


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    filename = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class JobOpportunity(Base):
    __tablename__ = "job_opportunities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    company_name = Column(String, nullable=False)
    job_title = Column(String, nullable=False)
    job_description = Column(String, nullable=False)
    match_score = Column(Integer, nullable=True)
    match_result = Column(String, nullable=True)
    tailored_resume = Column(String, nullable=True)
    cover_letter = Column(String, nullable=True)
    application_pack = Column(String, nullable=True)
    status = Column(String, nullable=False, default="saved")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    job_role = Column(String, nullable=False)
    score = Column(Integer, nullable=False)
    result = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)

    # Lightweight local SQLite migration for new columns added after MVP launch.
    # create_all() does not alter an existing table, so add missing columns safely.
    if DATABASE_URL.startswith("sqlite"):
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("job_opportunities")}
        if "application_pack" not in columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE job_opportunities ADD COLUMN application_pack TEXT")
                )
