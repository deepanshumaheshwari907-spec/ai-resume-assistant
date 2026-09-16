"""Deterministic JD-to-resume matching for ResumeAI.

The engine separates explicit required skills from preferred/bonus skills where
possible and produces a reproducible 0-100 score.
"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple

SKILLS: Tuple[str, ...] = (
    "python", "java", "javascript", "typescript", "c++", "sql", "fastapi", "django", "flask",
    "node.js", "express", "react", "next.js", "html", "css", "tailwind", "redux", "rest api",
    "api", "postgresql", "mysql", "mongodb", "redis", "docker", "git", "github", "linux",
    "kubernetes", "aws", "azure", "gcp", "terraform", "ci/cd", "testing", "pytest",
    "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
    "nlp", "computer vision", "generative ai", "llm", "prompt engineering", "statistics",
    "data analysis", "data visualization", "power bi", "tableau", "excel", "figma", "wireframing",
    "prototyping", "user research", "design systems", "authentication", "jwt", "restful api",
)

SYNONYMS: Dict[str, Tuple[str, ...]] = {
    "scikit-learn": ("sklearn",),
    "node.js": ("nodejs", "node js"),
    "next.js": ("nextjs",),
    "machine learning": ("ml",),
    "deep learning": ("neural networks", "cnn", "rnn", "transformer"),
    "generative ai": ("genai", "generative artificial intelligence"),
    "llm": ("large language model", "large language models"),
    "computer vision": ("opencv",),
    "rest api": ("restful api", "rest"),
    "postgresql": ("postgres",),
    "authentication": ("auth",),
}

REQUIRED_HEADINGS = (
    "requirements", "required qualifications", "qualifications", "must have",
    "required skills", "what you will need", "basic qualifications",
)
PREFERRED_HEADINGS = (
    "preferred", "preferred qualifications", "nice to have", "good to have",
    "bonus", "preferred skills", "plus", "additional qualifications",
)


def _norm(text: str) -> str:
    text = (text or "").lower().replace("–", "-").replace("—", "-")
    text = re.sub(r"[^a-z0-9+#./ -]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains(text: str, term: str) -> bool:
    return _norm(term) in text


def _skill_candidates(skill: str) -> Tuple[str, ...]:
    return (skill,) + SYNONYMS.get(skill, ())


def _extract_skills(job_description: str) -> List[str]:
    text = _norm(job_description)
    return [skill for skill in SKILLS if any(_contains(text, candidate) for candidate in _skill_candidates(skill))]


def _section_texts(job_description: str) -> Tuple[str, str]:
    lines = [ln.strip() for ln in (job_description or "").splitlines() if ln.strip()]
    required_lines: List[str] = []
    preferred_lines: List[str] = []
    current = "general"
    for line in lines:
        n = _norm(line).rstrip(":")
        if any(n == h or n.startswith(h + ":") for h in REQUIRED_HEADINGS):
            current = "required"
            continue
        if any(n == h or n.startswith(h + ":") for h in PREFERRED_HEADINGS):
            current = "preferred"
            continue
        # Also recognize headings embedded in lines such as "Requirements:"
        if any(n.startswith(h + " ") or n.startswith(h + ":") for h in REQUIRED_HEADINGS):
            current = "required"
        elif any(n.startswith(h + " ") or n.startswith(h + ":") for h in PREFERRED_HEADINGS):
            current = "preferred"
        if current == "required":
            required_lines.append(line)
        elif current == "preferred":
            preferred_lines.append(line)
    return "\n".join(required_lines), "\n".join(preferred_lines)


def _classify_skills(job_description: str) -> Tuple[List[str], List[str], List[str]]:
    all_skills = _extract_skills(job_description)
    required_text, preferred_text = _section_texts(job_description)
    required_norm = _norm(required_text)
    preferred_norm = _norm(preferred_text)

    required: List[str] = []
    preferred: List[str] = []
    uncategorized: List[str] = []
    for skill in all_skills:
        if required_norm and any(_contains(required_norm, c) for c in _skill_candidates(skill)):
            required.append(skill)
        elif preferred_norm and any(_contains(preferred_norm, c) for c in _skill_candidates(skill)):
            preferred.append(skill)
        else:
            uncategorized.append(skill)

    # Put uncategorized technical skills into the required bucket when the JD
    # has no explicit preferred section; otherwise keep them as general terms.
    if not preferred_norm:
        required.extend(uncategorized)
        uncategorized = []
    return required, preferred, uncategorized


def _match(resume_text: str, skills: List[str]) -> Tuple[List[str], List[str]]:
    text = _norm(resume_text)
    matched, missing = [], []
    for skill in skills:
        (matched if any(_contains(text, c) for c in _skill_candidates(skill)) else missing).append(skill)
    return matched, missing


def calculate_job_match(resume_text: str, job_description: str) -> Dict[str, object]:
    required, preferred, general = _classify_skills(job_description)
    matched_required, missing_required = _match(resume_text, required)
    matched_preferred, missing_preferred = _match(resume_text, preferred)
    matched_general, missing_general = _match(resume_text, general)

    # Deterministic weighted score: required 70%, preferred 20%, general 10%.
    required_score = (len(matched_required) / len(required) * 70) if required else 0
    preferred_score = (len(matched_preferred) / len(preferred) * 20) if preferred else 0
    general_score = (len(matched_general) / len(general) * 10) if general else 0

    active_weight = (70 if required else 0) + (20 if preferred else 0) + (10 if general else 0)
    if active_weight:
        raw_score = ((required_score + preferred_score + general_score) / active_weight) * 100
    else:
        raw_score = 0

    # Small, deterministic quality signal for a real JD with responsibilities/requirements.
    text = _norm(job_description)
    signal_words = ("responsibilities", "requirements", "qualifications", "experience", "build", "develop", "deploy")
    quality_bonus = min(5, sum(1 for s in signal_words if s in text))
    score = max(0, min(100, round(raw_score * 0.95 + quality_bonus)))

    matched_all = matched_required + matched_preferred + matched_general
    missing_all = missing_required + missing_preferred + missing_general

    if score >= 80:
        recommendation = "Strong overlap. Tailor your strongest evidence to the most important requirements and keep the wording role-specific."
    elif score >= 60:
        recommendation = "Good overlap, but some important requirements are missing or underrepresented. Prioritize truthful evidence for the missing items."
    elif score >= 40:
        recommendation = "Partial overlap. Strengthen the resume around the role's core requirements where your existing experience supports them."
    else:
        recommendation = "Low overlap. Compare the role requirements with your actual experience before tailoring the resume."

    return {
        "match_score": score,
        "matched_keywords": matched_all,
        "missing_keywords": missing_all,
        "recommendation": recommendation,
        "required_keywords": required,
        "matched_required": matched_required,
        "missing_required": missing_required,
        "preferred_keywords": preferred,
        "matched_preferred": matched_preferred,
        "missing_preferred": missing_preferred,
        "general_keywords": general,
        "matched_general": matched_general,
        "missing_general": missing_general,
        "score_breakdown": {
            "required_skills": {"score": round(required_score), "max": 70},
            "preferred_skills": {"score": round(preferred_score), "max": 20},
            "general_alignment": {"score": round(general_score), "max": 10},
        },
    }
