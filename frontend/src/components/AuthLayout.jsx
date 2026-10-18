import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./AuthLayout.css";

const STEPS = [
  ["01", "Resume", "Your source of truth"],
  ["02", "Role", "The opportunity you want"],
  ["03", "Match", "Signals worth attention"],
  ["04", "Apply", "A focused application"],
];

export default function AuthLayout({ children, mode = "login" }) {
  const navigate = useNavigate();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const onMove = (event) => {
      const x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
      const y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
      setPointer({ x, y });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const timer = window.setInterval(() => setActiveStep((step) => (step + 1) % STEPS.length), 3000);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(timer);
    };
  }, []);

  const story = useMemo(() => mode === "signup"
    ? {
        kicker: "APPLICATION INTELLIGENCE / CREATE",
        title: <>Build the workspace<br /><em>behind every application.</em></>,
        body: "Create one focused workspace for your resume, target roles, analysis, and application progress.",
        micro: "Your resume stays the source of truth.",
      }
    : {
        kicker: "APPLICATION INTELLIGENCE / RETURN",
        title: <>Continue the application<br /><em>you were building.</em></>,
        body: "ResumeAI keeps your resume, role context, analysis, and application work connected so you can pick up where you left off.",
        micro: "One workspace. Every opportunity.",
      }, [mode]);

  return (
    <div
      className={`auth-page auth-${mode}`}
      style={{ "--px": pointer.x, "--py": pointer.y }}
    >
      <div className="auth-noise" aria-hidden="true" />
      <div className="auth-lines" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-a" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-b" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-a" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-b" aria-hidden="true" />

      <header className="auth-topbar">
        <button className="auth-brand" type="button" onClick={() => navigate("/")} aria-label="ResumeAI home">
          <span className="auth-brand-mark" aria-hidden="true"><i /><i /><i /><b /></span>
          <span className="auth-brand-copy"><strong>RESUMEAI</strong><small>APPLICATION INTELLIGENCE</small></span>
        </button>

        <div className="auth-topright">
          <span className="auth-secure"><i /> SECURE WORKSPACE</span>
          <button type="button" className="auth-home" onClick={() => navigate("/")}>
            <ArrowLeft size={13} /> HOME
          </button>
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-story" aria-label="ResumeAI application intelligence">
          <div className="auth-story-copy">
            <span className="auth-kicker"><i /> {story.kicker}</span>
            <h1>{story.title}</h1>
            <p>{story.body}</p>
            <div className="auth-story-foot"><span className="auth-story-dot" /> {story.micro}</div>
          </div>

          <div className="auth-scene" aria-hidden="true">
            <div className="scene-beam scene-beam-v" />
            <div className="scene-beam scene-beam-h" />

            <div className="resume-object">
              <div className="resume-topline"><span>RESUMEAI / CURRENT VERSION</span><i /></div>
              <div className="resume-name">AI / ML ENGINEER</div>
              <div className="resume-meta">PYTHON · FASTAPI · MACHINE LEARNING · REACT · SQL</div>
              <div className="resume-rule" />
              <span className="resume-section">EXPERIENCE</span>
              <div className="resume-lines"><i /><i /><i /><i /></div>
              <span className="resume-section">PROJECTS</span>
              <div className="resume-pills"><b>ResumeAI</b><b>Cloud Detection</b><b>Credit Intelligence</b></div>
              <span className="resume-section">TARGET ROLE</span>
              <div className="resume-target">Machine Learning Engineer</div>
              <span className="resume-status">{mode === "signup" ? "NEW WORKSPACE" : "CURRENT WORKSPACE"}</span>
            </div>

            <div className="analysis-object">
              <div className="analysis-head"><span>LIVE ANALYSIS</span><small><i /> RUNNING</small></div>
              <div className="analysis-score"><strong>{mode === "signup" ? "01" : "82"}</strong><span>{mode === "signup" ? "ROLE" : "%"}</span></div>
              <div className="analysis-label">ROLE-SPECIFIC FIT</div>
              <div className="analysis-bars"><i style={{ "--w": "84%" }} /><i style={{ "--w": "68%" }} /><i style={{ "--w": "53%" }} /></div>
              <div className="analysis-tags"><b>Python ✓</b><b>FastAPI ✓</b><b>Docker —</b></div>
            </div>

            <div className="context-object">
              <span><Sparkles size={12} /> CONTEXT</span>
              <strong>{activeStep === 0 ? "Resume loaded" : activeStep === 1 ? "Role connected" : activeStep === 2 ? "Signals mapped" : "Application ready"}</strong>
            </div>
          </div>

          <div className="auth-steps">
            {STEPS.map(([number, title, text], index) => (
              <div className={`auth-step ${activeStep === index ? "is-active" : ""}`} key={number}>
                <span>{number}</span>
                <div><strong>{title}</strong><small>{text}</small></div>
                {index < STEPS.length - 1 && <Check size={12} />}
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-inner">
            <div className="auth-panel-rule" />
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
