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
    "data analysis", "data visualization", "power bi", "tableau", "excel", "figma", "adobe xd",
    "wireframing", "prototyping", "user research", "user journey mapping", "usability testing",
    "accessibility", "design systems", "authentication", "jwt",
)

SYNONYMS: Dict[str, Tuple[str, ...]] = {
    "scikit-learn": ("sklearn",),
    "node.js": ("nodejs", "node js"),
    "next.js": ("nextjs",),
    "machine learning": ("ml",),
    "deep learning": ("neural networks", "cnn", "rnn", "transformer"),
    "generative ai": ("genai", "generative artificial intelligence"),
    "llm": ("llms", "large language model", "large language models"),
    "api": ("apis",),
    "computer vision": ("opencv",),
    "rest api": ("restful api", "rest apis", "restful apis"),
    "postgresql": ("postgres",),
    "authentication": ("auth",),
    "adobe xd": ("adobe experience design",),
    "usability testing": ("usability test", "usability tests", "usability evaluation"),
    "accessibility": (
        "accessibility guideline", "accessibility guidelines",
        "accessibility principle", "accessibility principles",
        "web accessibility", "accessible design",
        "accessible user interface", "accessible user interfaces",
        "accessible interface", "accessible interfaces",
        "accessible ui", "wcag",
    ),
    "user journey mapping": (
        "user journey map", "user journey maps", "journey mapping", "customer journey mapping",
    ),
}

REQUIRED_HEADINGS = (
    "requirements", "required qualifications", "minimum qualifications",
    "minimum requirements", "qualifications", "must have", "must haves",
    "required skills", "required technical skills", "technical requirements",
    "mandatory skills", "essential skills", "what you will need", "what you ll need",
    "basic qualifications",
)
PREFERRED_HEADINGS = (
    "preferred", "preferred qualifications", "nice to have", "good to have",
    "bonus", "preferred skills", "plus", "additional qualifications",
    "desired skills", "desirable skills", "bonus skills",
)
GENERAL_HEADINGS = (
    "about", "about the role", "about us", "overview", "job overview", "role overview",
    "responsibilities", "key responsibilities", "job responsibilities", "duties",
    "what you will do", "what you ll do", "the role", "role description", "job description",
    "eligibility", "who you are", "who we are", "selection process", "interview process",
    "application process", "how to apply", "benefits", "compensation", "location",
    "employment type", "what we offer", "equal opportunity", "company overview",
    "company", "team", "additional information", "your impact", "the opportunity",
)


def _norm(text: str) -> str:
    text = (text or "").lower().replace("–", "-").replace("—", "-")
    text = re.sub(r"[^a-z0-9+#./ -]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains(text: str, term: str) -> bool:
    """Match whole skill tokens/phrases to avoid false positives like Java in JavaScript."""
    normalized_text = _norm(text)
    normalized_term = _norm(term)
    if not normalized_text or not normalized_term:
        return False
    parts = re.split(r"\s+", normalized_term)
    phrase = r"\s+".join(re.escape(part) for part in parts)
    return re.search(rf"(?<![a-z0-9]){phrase}(?![a-z0-9])", normalized_text) is not None


def _heading_key(line: str) -> str:
    """Normalize plain, Markdown, bold, and numbered section headings."""
    value = (line or "").strip()
    value = re.sub(r"^\s{0,3}#{1,6}\s*", "", value)
    value = re.sub(r"^\s*\d+[.)]\s*", "", value)
    value = re.sub(r"[*_`~]", "", value)
    value = re.sub(r"\s+#{1,6}\s*$", "", value)
    value = _norm(value).strip().rstrip(":").strip()
    value = re.sub(r"[-_/]+", " ", value)
    value = re.sub(r"[^a-z0-9 ]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _matches_heading(value: str, headings: Tuple[str, ...]) -> bool:
    return any(value == heading or value.startswith(heading + " ") for heading in headings)


def _skill_candidates(skill: str) -> Tuple[str, ...]:
    return (skill,) + SYNONYMS.get(skill, ())


def _extract_skills(job_description: str) -> List[str]:
    text = _norm(job_description)
    found = [skill for skill in SKILLS if any(_contains(text, candidate) for candidate in _skill_candidates(skill))]
    # Prefer specific concepts over generic terms to avoid duplicate counting.
    if "rest api" in found:
        found = [skill for skill in found if skill != "api"]
    if "usability testing" in found:
        found = [skill for skill in found if skill != "testing"]
    return found


def _section_texts(job_description: str) -> Tuple[str, str]:
    """Extract explicit required/preferred sections from common JD formatting styles."""
    lines = [ln.strip() for ln in (job_description or "").splitlines() if ln.strip()]
    required_lines: List[str] = []
    preferred_lines: List[str] = []
    current = "general"

    for line in lines:
        value = _heading_key(line)
        is_markdown_heading = bool(re.match(r"^\s{0,3}#{1,6}\s+", line))
        is_bullet_item = bool(re.match(r"^\s*[-*+•]\s+", line))
        # Do not interpret ordinary bullets such as "- Experience with FastAPI" as headings.
        # Numbered headings ("1. Required Skills") remain eligible after prefix normalization.
        can_be_heading = is_markdown_heading or not is_bullet_item

        if can_be_heading and _matches_heading(value, REQUIRED_HEADINGS):
            current = "required"
            # Keep content on a heading-like line such as "Required Skills include Python".
            if value in REQUIRED_HEADINGS or value.rstrip(":") in REQUIRED_HEADINGS:
                continue
        elif can_be_heading and _matches_heading(value, PREFERRED_HEADINGS):
            current = "preferred"
            if value in PREFERRED_HEADINGS:
                continue
        elif can_be_heading and _matches_heading(value, GENERAL_HEADINGS):
            current = "general"
            if value in GENERAL_HEADINGS:
                continue

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

    # Keep the original relative weights (required/preferred/general = 70/20/10),
    # but redistribute them across categories that are actually present in this JD.
    # The displayed category contributions therefore add up to the overall score.
    base_weights = {
        "required_skills": 70,
        "preferred_skills": 20,
        "general_alignment": 10,
    }
    category_counts = {
        "required_skills": (len(matched_required), len(required)),
        "preferred_skills": (len(matched_preferred), len(preferred)),
        "general_alignment": (len(matched_general), len(general)),
    }
    active_categories = [key for key, (_, total) in category_counts.items() if total]
    active_weight = sum(base_weights[key] for key in active_categories)

    exact_maxima = {
        key: (base_weights[key] * 100 / active_weight if key in active_categories else 0.0)
        for key in base_weights
    } if active_weight else {key: 0.0 for key in base_weights}

    # Largest-remainder allocation keeps integer category maxima summing to 100.
    integer_maxima = {key: int(value) for key, value in exact_maxima.items()}
    if active_weight:
        remaining_points = 100 - sum(integer_maxima.values())
        remainder_order = sorted(
            active_categories,
            key=lambda key: (exact_maxima[key] - integer_maxima[key], -list(base_weights).index(key)),
            reverse=True,
        )
        for key in remainder_order[:remaining_points]:
            integer_maxima[key] += 1

    exact_points = {
        key: (matched / total * exact_maxima[key] if total else 0.0)
        for key, (matched, total) in category_counts.items()
    }
    score = max(0, min(100, round(sum(exact_points.values()))))

    # Allocate rounded point contributions so the displayed breakdown sums exactly to the score.
    integer_points = {key: int(value) for key, value in exact_points.items()}
    points_to_allocate = score - sum(integer_points.values())
    point_order = sorted(
        active_categories,
        key=lambda key: (exact_points[key] - integer_points[key], -list(base_weights).index(key)),
        reverse=True,
    )
    for key in point_order[:max(0, points_to_allocate)]:
        if integer_points[key] < integer_maxima[key]:
            integer_points[key] += 1

    # Guard rounding at edge cases so component points always sum to the displayed score.
    difference = score - sum(integer_points.values())
    if difference and active_categories:
        last_key = max(active_categories, key=lambda key: integer_maxima[key] - integer_points[key])
        integer_points[last_key] = max(0, min(integer_maxima[last_key], integer_points[last_key] + difference))

    matched_all = matched_required + matched_preferred + matched_general
    missing_all = missing_required + missing_preferred + missing_general

    if not active_categories:
        recommendation = "No recognizable skills were detected in this job description. Paste the complete posting, including its requirements and responsibilities, and try again."
    elif score >= 80:
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
            "required_skills": {"score": integer_points["required_skills"], "max": integer_maxima["required_skills"]},
            "preferred_skills": {"score": integer_points["preferred_skills"], "max": integer_maxima["preferred_skills"]},
            "general_alignment": {"score": integer_points["general_alignment"], "max": integer_maxima["general_alignment"]},
        },
    }
