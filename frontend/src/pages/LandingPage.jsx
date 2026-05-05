import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, MessageSquare, Download, CheckCircle, ArrowRight, Brain, Target, TrendingUp } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ background: "#0A0A0F", color: "#fff", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      
      {/* Navbar */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 60px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,15,0.95)", backdropFilter: "blur(12px)" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Resume<span style={{ color: "#F59E0B" }}>AI</span></div>
        <div style={{ display: "flex", gap: 12 }}>
          {user ? (
            <button style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 14, fontWeight: 600 }} onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          ) : (
            <>
              <button style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14 }} onClick={() => navigate("/login")}>Login</button>
              <button style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 14, fontWeight: 600 }} onClick={() => navigate("/signup")}>Get Started Free</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "100px 20px 80px", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", fontSize: 13, fontWeight: 500, marginBottom: 28 }}>
          <Zap size={13} /> AI-Powered Resume Analysis
        </div>
        <h1 style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-2px", marginBottom: 22 }}>
          Get Hired Faster with<br />
          <span style={{ color: "#F59E0B" }}>AI That Knows</span><br />
          What Recruiters Want
        </h1>
        <p style={{ fontSize: 19, color: "#888", lineHeight: 1.6, marginBottom: 40 }}>
          Upload your resume — get ATS score, missing keywords,<br />AI rewrite, and mock interview in under 60 seconds.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <button style={{ padding: "14px 32px", borderRadius: 10, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }} onClick={() => navigate("/signup")}>
            Analyze My Resume Free <ArrowRight size={18} />
          </button>
          <button style={{ padding: "14px 32px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 16 }} onClick={() => navigate("/login")}>
            Login
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", gap: 60, padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[["10,000+", "Resumes Analyzed"], ["94%", "ATS Pass Rate"], ["3x", "More Interviews"], ["Free", "To Get Started"]].map(([n, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#F59E0B" }}>{n}</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: "80px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 12 }}>Features</div>
        <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1px", marginBottom: 14 }}>Everything to Land Your Dream Job</h2>
        <p style={{ fontSize: 17, color: "#666", marginBottom: 50 }}>One tool that replaces expensive career coaches and resume writers.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {[
            { icon: <Target size={22} color="#F59E0B" />, title: "ATS Score Analysis", desc: "Get a real ATS score with exact issues — know why recruiters skip your resume." },
            { icon: <Zap size={22} color="#F59E0B" />, title: "AI Resume Rewrite", desc: "AI rewrites your resume with powerful action verbs, keywords, and impact metrics." },
            { icon: <MessageSquare size={22} color="#F59E0B" />, title: "Mock Interview Bot", desc: "Practice with an AI interviewer that gives real feedback after every answer." },
            { icon: <Download size={22} color="#F59E0B" />, title: "PDF Download", desc: "Download your upgraded resume in a clean, recruiter-friendly PDF instantly." },
            { icon: <Brain size={22} color="#F59E0B" />, title: "Missing Keywords", desc: "Spot exact keywords your target role needs — never miss a critical skill again." },
            { icon: <TrendingUp size={22} color="#F59E0B" />, title: "Job Role Matching", desc: "Paste any job role and get a tailored resume score and improvement plan." },
          ].map((f) => (
            <div key={f.title} style={{ padding: 28, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ padding: "80px 60px", maxWidth: 1100, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
        <h2 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1px", marginBottom: 50 }}>Simple, Honest Pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {/* Free */}
          <div style={{ padding: 30, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Free</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 4 }}>₹0</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>Forever free</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["2 resume analyses/month", "ATS Score", "Strengths & weaknesses"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#ccc", marginBottom: 12 }}><CheckCircle size={15} color="#F59E0B" />{f}</li>
              ))}
              {["Resume rewrite", "PDF download", "Mock interview"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#444", marginBottom: 12 }}><CheckCircle size={15} color="#333" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 15 }} onClick={() => navigate("/signup")}>Get Started</button>
          </div>

          {/* Pro */}
          <div style={{ padding: 30, borderRadius: 16, background: "rgba(245,158,11,0.06)", border: "2px solid #F59E0B" }}>
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 99, background: "#F59E0B", color: "#000", fontSize: 11, fontWeight: 700, marginBottom: 14 }}>MOST POPULAR</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Pro</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 4 }}>₹199</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>per month</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["Unlimited analyses", "AI Resume Rewrite ✨", "Mock Interview Bot 🎤", "PDF Download", "Missing Keywords", "Priority Support"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#ccc", marginBottom: 12 }}><CheckCircle size={15} color="#F59E0B" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 15, fontWeight: 700 }} onClick={() => navigate("/signup")}>Start Free Trial</button>
          </div>

          {/* Elite */}
          <div style={{ padding: 30, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Elite</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 4 }}>₹499</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>per month</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["Everything in Pro", "Job Description Match", "LinkedIn Optimization", "Cover Letter AI", "Dedicated Support"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#ccc", marginBottom: 12 }}><CheckCircle size={15} color="#F59E0B" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 15 }} onClick={() => navigate("/signup")}>Get Elite</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "30px", borderTop: "1px solid rgba(255,255,255,0.06)", color: "#444", fontSize: 13 }}>
        © 2025 ResumeAI · Made in India 
      </div>
    </div>
  );
}