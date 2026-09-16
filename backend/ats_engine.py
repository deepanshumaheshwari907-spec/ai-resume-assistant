"""Deterministic ATS compatibility scoring for ResumeAI.

The final numeric score is produced entirely by this module. No LLM is used
for scoring, which makes the result reproducible for the same resume + role.
The AI layer can consume this output later for explanations and suggestions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


@dataclass(frozen=True)
class RoleProfile:
    name: str
    skills: Tuple[str, ...]
    synonyms: Dict[str, Tuple[str, ...]]
    role_terms: Tuple[str, ...]


ROLE_PROFILES: Dict[str, RoleProfile] = {
    "ai/ml engineer": RoleProfile(
        name="AI/ML Engineer",
        skills=(
            "python", "machine learning", "deep learning", "tensorflow", "pytorch",
            "scikit-learn", "sql", "fastapi", "pandas", "numpy", "docker", "git",
            "nlp", "computer vision", "generative ai", "llm",
        ),
        synonyms={
            "machine learning": ("ml",),
            "deep learning": ("neural networks", "cnn", "rnn", "transformer"),
            "scikit-learn": ("sklearn",),
            "generative ai": ("genai", "generative artificial intelligence"),
            "llm": ("large language model", "large language models"),
            "computer vision": ("opencv",),
        },
        role_terms=(
            "ai", "ml", "machine learning", "deep learning", "model", "python",
            "nlp", "vision", "data", "algorithm",
        ),
    ),
    "ml engineer": RoleProfile(
        name="ML Engineer",
        skills=(
            "python", "machine learning", "deep learning", "tensorflow", "pytorch",
            "scikit-learn", "sql", "pandas", "numpy", "docker", "git", "nlp",
            "computer vision", "mlops", "fastapi",
        ),
        synonyms={
            "machine learning": ("ml",),
            "scikit-learn": ("sklearn",),
        },
        role_terms=("ml", "machine learning", "model", "python", "mlops", "nlp", "algorithm"),
    ),
    "data scientist": RoleProfile(
        name="Data Scientist",
        skills=(
            "python", "sql", "machine learning", "statistics", "pandas", "numpy",
            "scikit-learn", "tensorflow", "pytorch", "data analysis", "visualization",
            "matplotlib", "power bi", "tableau", "jupyter", "git",
        ),
        synonyms={"scikit-learn": ("sklearn",), "data analysis": ("analytics",)},
        role_terms=(
            "data", "analysis", "analytics", "statistics", "machine learning",
            "python", "sql", "model", "insights",
        ),
    ),
    "backend": RoleProfile(
        name="Backend Engineer",
        skills=(
            "python", "java", "javascript", "typescript", "fastapi", "django",
            "flask", "node.js", "express", "rest api", "api", "sql", "postgresql",
            "mysql", "mongodb", "redis", "docker", "git", "authentication", "jwt",
        ),
        synonyms={
            "node.js": ("nodejs", "node js"),
            "rest api": ("restful api", "rest"),
            "postgresql": ("postgres",),
        },
        role_terms=("backend", "api", "server", "database", "fastapi", "django", "node", "sql"),
    ),
    "software engineer": RoleProfile(
        name="Software Engineer",
        skills=(
            "python", "java", "javascript", "typescript", "c++", "sql", "git",
            "data structures", "algorithms", "rest api", "testing", "docker", "linux",
            "postgresql", "mongodb",
        ),
        synonyms={
            "data structures": ("dsa",),
            "algorithms": ("problem solving",),
            "rest api": ("restful api", "rest"),
        },
        role_terms=(
            "software", "development", "engineering", "python", "java", "javascript",
            "api", "git", "testing",
        ),
    ),
    "frontend": RoleProfile(
        name="Frontend Engineer",
        skills=(
            "javascript", "typescript", "react", "next.js", "html", "css", "tailwind",
            "redux", "rest api", "git", "testing", "responsive design",
        ),
        synonyms={
            "next.js": ("nextjs",),
            "rest api": ("restful api", "rest"),
        },
        role_terms=("frontend", "front-end", "react", "javascript", "typescript", "ui", "web"),
    ),
    "full stack": RoleProfile(
        name="Full Stack Engineer",
        skills=(
            "javascript", "typescript", "react", "node.js", "python", "fastapi", "html",
            "css", "sql", "postgresql", "mongodb", "rest api", "docker", "git",
        ),
        synonyms={
            "node.js": ("nodejs", "node js"),
            "rest api": ("restful api", "rest"),
        },
        role_terms=(
            "full stack", "frontend", "backend", "react", "api", "database", "javascript",
        ),
    ),
    "ui/ux designer": RoleProfile(
        name="UI/UX Designer",
        skills=(
            "figma", "wireframing", "prototyping", "user research", "usability testing",
            "design systems", "interaction design", "visual design", "information architecture",
            "adobe xd", "sketch", "responsive design",
        ),
        synonyms={
            "user research": ("ux research",),
            "wireframing": ("wireframes",),
            "prototyping": ("prototype",),
        },
        role_terms=("ui", "ux", "design", "figma", "wireframe", "prototype", "user experience"),
    ),
    "data analyst": RoleProfile(
        name="Data Analyst",
        skills=(
            "sql", "excel", "python", "pandas", "power bi", "tableau", "statistics",
            "data analysis", "data visualization", "dashboards", "reporting", "git",
        ),
        synonyms={
            "data visualization": ("visualization",),
            "data analysis": ("analytics",),
        },
        role_terms=(
            "data", "analysis", "sql", "excel", "dashboard", "reporting", "analytics",
        ),
    ),
}

GENERIC_PROFILE = RoleProfile(
    name="General Technical Role",
    skills=("python", "sql", "git", "javascript", "api", "testing", "docker", "linux"),
    synonyms={"api": ("rest api", "restful api")},
    role_terms=("software", "engineering", "development", "technical"),
)


def _norm(text: str) -> str:
    text = (text or "").lower().replace("–", "-").replace("—", "-")
    text = re.sub(r"[^a-z0-9+#./ -]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _has_phrase(text: str, phrase: str) -> bool:
    """Match terms without false positives such as 'ml' inside unrelated words."""
    p = _norm(phrase)
    if not p:
        return False
    if len(p) <= 3 or any(ch in p for ch in "+#./"):
        return re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", text) is not None
    return p in text


def _first_role_key(job_role: str) -> str:
    role = _norm(job_role)
    replacements = {
        "ai ml engineer": "ai/ml engineer",
        "ai / ml engineer": "ai/ml engineer",
        "aiml engineer": "ai/ml engineer",
        "machine learning engineer": "ml engineer",
        "backend developer": "backend",
        "back end": "backend",
        "front end": "frontend",
        "frontend developer": "frontend",
        "full-stack engineer": "full stack",
        "full-stack developer": "full stack",
        "ui ux designer": "ui/ux designer",
        "ui/ux": "ui/ux designer",
        "data analyst": "data analyst",
    }
    return replacements.get(role, role)


def get_role_profile(job_role: str) -> RoleProfile:
    key = _first_role_key(job_role)
    if key in ROLE_PROFILES:
        return ROLE_PROFILES[key]
    for name, profile in ROLE_PROFILES.items():
        if name in key or key in name:
            return profile
    return generic_profile_for_role(job_role)


def generic_profile_for_role(job_role: str) -> RoleProfile:
    role = _norm(job_role)
    role_words = tuple(
        word for word in re.findall(r"[a-z][a-z0-9+#./-]{2,}", role)
        if word not in {"engineer", "developer", "intern", "role", "senior", "junior"}
    )
    return RoleProfile(
        name=job_role.strip() or GENERIC_PROFILE.name,
        skills=GENERIC_PROFILE.skills,
        synonyms=GENERIC_PROFILE.synonyms,
        role_terms=GENERIC_PROFILE.role_terms + role_words,
    )


# Backward-compatible alias with the old module's name.
GenericProfileForRole = generic_profile_for_role


def _coverage(text: str, terms: Iterable[str], synonyms: Dict[str, Tuple[str, ...]]) -> Tuple[int, List[str], List[str]]:
    matched: List[str] = []
    missing: List[str] = []
    for term in terms:
        candidates = (term,) + tuple(synonyms.get(term, ()))
        if any(_has_phrase(text, candidate) for candidate in candidates):
            matched.append(term)
        else:
            missing.append(term)
    return len(matched), matched, missing


def _section_presence(raw: str) -> Dict[str, bool]:
    text = _norm(raw)
    sections = {
        "summary": ("summary", "professional summary", "profile"),
        "skills": ("skills", "technical skills", "core skills"),
        "experience": ("experience", "work experience", "internship", "employment"),
        "projects": ("projects", "academic projects", "personal projects"),
        "education": ("education", "academic background", "academic qualification"),
        "certifications": ("certifications", "certification", "courses"),
    }
    return {name: any(variant in text for variant in variants) for name, variants in sections.items()}


def _evidence_score(raw: str, patterns: Iterable[str], max_score: int) -> int:
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return 0
    matched_lines = 0
    for line in lines:
        normalized = _norm(line)
        if any(_has_phrase(normalized, pattern) for pattern in patterns):
            matched_lines += 1
    ratio = matched_lines / max(1, min(len(lines), 20))
    return min(max_score, round(ratio * max_score))


def _experience_project_score(raw: str, profile: RoleProfile) -> int:
    """Score role-relevant evidence in experience/project content, not raw length."""
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return 0

    role_hit_lines = 0
    keyword_hit_lines = 0
    for line in lines:
        normalized = _norm(line)
        if any(_has_phrase(normalized, term) for term in profile.role_terms):
            role_hit_lines += 1
        if any(_has_phrase(normalized, term) for term in profile.skills):
            keyword_hit_lines += 1

    # Cap influence so one huge keyword-dense resume does not automatically max this category.
    relevant = min(12, role_hit_lines + keyword_hit_lines)
    score = round((relevant / 12) * 16)

    presence = _section_presence(raw)
    if presence["experience"]:
        score += 2
    if presence["projects"]:
        score += 2
    return min(20, score)


def _impact_score(raw: str) -> int:
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return 0
    candidates = [line for line in lines if re.match(r"^(?:[-•*▪▸]|\d+[.)])\s*", line)] or lines
    quantified = 0
    strong_action = 0
    for line in candidates[:20]:
        if re.search(
            r"\b\d+(?:\.\d+)?\s*(?:%|x|k|m|hrs?|hours?|days?|weeks?|months?|users?|records?|ms|s)\b",
            line,
            re.I,
        ) or re.search(r"\b\d+(?:\.\d+)?%\b", line):
            quantified += 1
        if re.match(
            r"^(?:[-•*▪▸]|\d+[.)])\s*(?:built|developed|designed|implemented|created|optimized|automated|improved|trained|deployed|integrated|analyzed|led|engineered|launched)\b",
            line,
            re.I,
        ):
            strong_action += 1

    evidence = min(7, round((quantified / max(1, min(len(candidates), 10))) * 7))
    action = min(3, strong_action)
    return min(10, evidence + action)


def _readability_score(raw: str) -> int:
    text = (raw or "").strip()
    if not text:
        return 0

    score = 0
    length = len(text)
    if 1200 <= length <= 9000:
        score += 3
    elif 500 <= length < 1200 or 9000 < length <= 12000:
        score += 2
    elif length >= 250:
        score += 1

    presence = _section_presence(text)
    score += min(4, sum(presence[name] for name in ("summary", "skills", "experience", "projects")))

    if re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", raw, re.I):
        score += 1
    if re.search(r"(?:linkedin\.com|github\.com)", raw, re.I):
        score += 1
    if sum(1 for _ in re.finditer(r"(?:^|\n)\s*[•*\-]\s+", raw)) >= 4:
        score += 1

    # Obvious extraction noise reduces ATS readability.
    if raw.count("| |") > 3 or raw.count("\\") > 20:
        score -= 2
    if re.search(r"\b(?:page|pg\.)\s*\d+\b", raw, re.I) and raw.count("page") > 3:
        score -= 1

    return max(0, min(10, score))


def _education_certification_score(raw: str) -> int:
    presence = _section_presence(raw)
    text = _norm(raw)
    score = 0

    if presence["education"]:
        score += 5
    if re.search(
        r"\b(?:b\.?tech|bachelor|master|m\.?tech|bsc|msc|bca|mca|phd|degree|diploma)\b",
        text,
        re.I,
    ):
        score += 2
    if re.search(r"\b(?:cgpa|gpa|percentage|percent)\b", text, re.I):
        score += 1
    if presence["certifications"]:
        score += 2
    elif re.search(r"\b(?:certified|certification|certificate|course completion)\b", text, re.I):
        score += 1

    return min(10, score)


def calculate_ats_score(resume_text: str, job_role: str) -> Dict[str, object]:
    """Calculate a reproducible 0-100 score and detailed evidence breakdown.

    Weights are fixed and sum to exactly 100:
      role alignment             25
      skills coverage            25
      experience/project         20
      impact evidence            10
      ATS readability            10
      education/certifications   10
    """
    raw = resume_text or ""
    text = _norm(raw)
    profile = get_role_profile(job_role)

    _, matched_skills, missing_skills = _coverage(text, profile.skills, profile.synonyms)
    _, matched_roles, _ = _coverage(text, profile.role_terms, {})

    role_alignment = round((len(matched_roles) / max(1, len(profile.role_terms))) * 25)
    skills_coverage = round((len(matched_skills) / max(1, len(profile.skills))) * 25)
    experience_project = _experience_project_score(raw, profile)
    impact = _impact_score(raw)
    readability = _readability_score(raw)
    education_certifications = _education_certification_score(raw)

    score = max(
        0,
        min(
            100,
            role_alignment
            + skills_coverage
            + experience_project
            + impact
            + readability
            + education_certifications,
        ),
    )

    return {
        "score": score,
        "score_breakdown": {
            "role_alignment": {"score": role_alignment, "max": 25},
            "skills_coverage": {"score": skills_coverage, "max": 25},
            "experience_project_relevance": {"score": experience_project, "max": 20},
            "impact_evidence": {"score": impact, "max": 10},
            "ats_readability": {"score": readability, "max": 10},
            "education_and_certifications": {"score": education_certifications, "max": 10},
        },
        "matched_keywords": matched_skills,
        "missing_keywords": missing_skills,
        "role_profile": profile.name,
    }
