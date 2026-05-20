import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, MessageSquare, Download, CheckCircle, ArrowRight, Brain, Target, TrendingUp, Star } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ background: "#080810", color: "#fff", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", overflowX: "hidden" }}>

      {/* Navbar */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px" : "18px 60px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100, background: "rgba(8,8,16,0.97)", backdropFilter: "blur(20px)" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Resume<span style={{ color: "#F59E0B" }}>AI</span>
          <span style={{ fontSize: 10, background: "#F59E0B", color: "#000", padding: "2px 6px", borderRadius: 4, marginLeft: 6, fontWeight: 700, verticalAlign: "middle" }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {user ? (
            <button style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 14, fontWeight: 700 }} onClick={() => navigate("/dashboard")}>
              Dashboard →
            </button>
          ) : (
            <>
              <button style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14 }} onClick={() => navigate("/login")}>Login</button>
              <button style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer", fontSize: 14, fontWeight: 700 }} onClick={() => navigate("/signup")}>Get Started Free</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: isMobile ? "60px 20px 50px" : "100px 20px 80px", maxWidth: 820, margin: "0 auto", position: "relative" }}>
        {/* Glow effect */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 99, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontSize: 13, fontWeight: 500, marginBottom: 32 }}>
          <Zap size={13} fill="#F59E0B" /> AI-Powered Resume Analysis • Free to Start
        </div>

        <h1 style={{ fontSize: isMobile ? "clamp(36px, 10vw, 52px)" : 62, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-2.5px", marginBottom: 24, background: "linear-gradient(135deg, #ffffff 0%, #cccccc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Land Your Dream Job<br />
          <span style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>10x Faster</span> with AI
        </h1>

        <p style={{ fontSize: isMobile ? 16 : 19, color: "#888", lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: "0 auto 40px" }}>
          Upload your resume. Get your ATS score, missing keywords, AI rewrite, mock interview & cover letter — all in under 60 seconds.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
          <button style={{ padding: "15px 36px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 32px rgba(245,158,11,0.35)" }} onClick={() => navigate("/signup")}>
            Analyze My Resume Free <ArrowRight size={18} />
          </button>
          <button style={{ padding: "15px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#ccc", cursor: "pointer", fontSize: 15 }} onClick={() => navigate("/login")}>
            Login to Dashboard
          </button>
        </div>

        <p style={{ fontSize: 13, color: "#444" }}>✓ No credit card required &nbsp; ✓ 2 free analyses/month &nbsp; ✓ Instant results</p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 16 : 50, padding: "32px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
        {[["10,000+", "Resumes Analyzed"], ["94%", "ATS Pass Rate"], ["3x", "More Interviews"], ["60s", "Average Time"]].map(([n, l]) => (
          <div key={l} style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 900, background: "linear-gradient(135deg, #F59E0B, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{n}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: isMobile ? "60px 20px" : "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 12 }}>Everything You Need</div>
          <h2 style={{ fontSize: isMobile ? 30 : 40, fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>One Tool. All Features.</h2>
          <p style={{ fontSize: 16, color: "#555" }}>Replace 5 different tools with one AI-powered platform</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          {[
            { icon: <Target size={20} color="#F59E0B" />, title: "ATS Score Analysis", desc: "Get your exact ATS score with detailed breakdown. Know why recruiters skip your resume.", badge: "Most Popular" },
            { icon: <Zap size={20} color="#F59E0B" />, title: "AI Resume Rewrite", desc: "AI rewrites your resume with power verbs, keywords & metrics that get interviews.", badge: null },
            { icon: <MessageSquare size={20} color="#F59E0B" />, title: "Mock Interview Bot", desc: "Practice with AI interviewer. Get real feedback on every answer instantly.", badge: null },
            { icon: <Download size={20} color="#F59E0B" />, title: "PDF Download", desc: "Download your upgraded resume in a clean, ATS-friendly PDF format.", badge: null },
            { icon: <Brain size={20} color="#F59E0B" />, title: "JD Match Score", desc: "Paste any job description. See exactly how well your resume matches.", badge: "New ✨" },
            { icon: <TrendingUp size={20} color="#F59E0B" />, title: "Cover Letter AI", desc: "Generate personalized cover letters for any job in seconds.", badge: "New ✨" },
          ].map((f) => (
            <div key={f.title} style={{ padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", position: "relative", transition: "border-color 0.2s" }}>
              {f.badge && <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>{f.badge}</div>}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: isMobile ? "60px 20px" : "80px 40px", background: "rgba(245,158,11,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 12 }}>How It Works</div>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 800, letterSpacing: "-1px", marginBottom: 50 }}>Ready in 60 Seconds</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 24 }}>
            {[
              { n: "1", title: "Upload Resume", desc: "Upload your PDF resume" },
              { n: "2", title: "AI Analyzes", desc: "AI reads every line" },
              { n: "3", title: "Get Report", desc: "ATS score + improvements" },
              { n: "4", title: "Apply & Win", desc: "Land more interviews" },
            ].map((s) => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 99, background: "linear-gradient(135deg, #F59E0B, #F97316)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, margin: "0 auto 14px", boxShadow: "0 4px 20px rgba(245,158,11,0.3)", color: "#000" }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#555" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div style={{ padding: isMobile ? "60px 20px" : "80px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#F59E0B", textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontSize: isMobile ? 28 : 38, fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>Simple & Honest Pricing</h2>
          <p style={{ color: "#555", fontSize: 15 }}>Start free. Upgrade when you're ready.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
          {/* Free */}
          <div style={{ padding: 28, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Free</div>
            <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4 }}>₹0</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>Forever free</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["2 analyses/month", "ATS Score", "Strengths & weaknesses"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa", marginBottom: 12 }}><CheckCircle size={14} color="#F59E0B" />{f}</li>
              ))}
              {["Resume rewrite", "PDF download", "Mock interview"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#333", marginBottom: 12 }}><CheckCircle size={14} color="#333" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 14 }} onClick={() => navigate("/signup")}>Get Started Free</button>
          </div>

          {/* Pro */}
          <div style={{ padding: 28, borderRadius: 18, background: "rgba(245,158,11,0.05)", border: "2px solid #F59E0B", position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 99 }}>MOST POPULAR</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Pro</div>
            <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4, color: "#F59E0B" }}>₹199</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>per month</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["Unlimited analyses", "AI Resume Rewrite ✨", "Mock Interview Bot 🎤", "PDF Download", "JD Match Score 🎯", "Cover Letter AI 📝"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#ccc", marginBottom: 12 }}><CheckCircle size={14} color="#F59E0B" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontSize: 14, fontWeight: 800, boxShadow: "0 4px 20px rgba(245,158,11,0.3)" }} onClick={() => navigate("/signup")}>Start Free Trial</button>
          </div>

          {/* Elite */}
          <div style={{ padding: 28, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Elite</div>
            <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 4 }}>₹499</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>per month</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
              {["Everything in Pro", "LinkedIn Optimization", "Priority Support", "Dedicated Account Manager", "Custom Resume Templates"].map(f => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#aaa", marginBottom: 12 }}><CheckCircle size={14} color="#F59E0B" />{f}</li>
              ))}
            </ul>
            <button style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 14 }} onClick={() => navigate("/signup")}>Get Elite</button>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div style={{ padding: isMobile ? "60px 20px" : "80px 40px", background: "rgba(245,158,11,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, marginBottom: 40 }}>What People Are Saying</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {[
              { name: "Rahul S.", role: "Software Engineer", text: "Got my ATS score from 45 to 82 in one session. Got 3 interview calls the next week!", stars: 5 },
              { name: "Priya M.", role: "Data Analyst", text: "The JD match feature is incredible. I knew exactly what to add before applying!", stars: 5 },
              { name: "Arjun K.", role: "ML Engineer", text: "Mock interview practice helped me crack my Google interview. Highly recommended!", stars: 5 },
            ].map((t) => (
              <div key={t.name} style={{ padding: 20, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "left" }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                  {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />)}
                </div>
                <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 14 }}>"{t.text}"</p>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", padding: isMobile ? "60px 20px" : "100px 20px", background: "linear-gradient(180deg, transparent 0%, rgba(245,158,11,0.04) 100%)" }}>
        <h2 style={{ fontSize: isMobile ? 28 : 46, fontWeight: 900, letterSpacing: "-1.5px", marginBottom: 16 }}>
          Your Dream Job is<br /><span style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>One Resume Away</span>
        </h2>
        <p style={{ color: "#555", fontSize: 16, marginBottom: 36 }}>Join thousands who upgraded their resume and got more interviews.</p>
        <button style={{ padding: "16px 40px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontSize: 17, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 8px 32px rgba(245,158,11,0.35)" }} onClick={() => navigate("/signup")}>
          Get Started Free — No Credit Card <ArrowRight size={18} />
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", color: "#333", fontSize: 13 }}>
        © 2026 ResumeAI · Made with ❤️ in India  · <span onClick={() => navigate("/terms")} style={{ color: "#F59E0B", cursor: "pointer" }}>Terms of Service</span>
      </div>
    </div>
  );
}