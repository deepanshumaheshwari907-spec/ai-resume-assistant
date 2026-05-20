import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import { LogOut, Zap, Download, CheckCircle, AlertCircle, Send,} from "lucide-react";

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;

  const [file, setFile] = useState(null);
  const [jobRole, setJobRole] = useState("");
  const [result, setResult] = useState(null);
  const [rewritten, setRewritten] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("analyze");
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdResult, setJdResult] = useState(null);
  const [jdLoading, setJdLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [coverLetter, setCoverLetter] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const handleLogout = () => { logout(); navigate("/"); };

  const handleAnalyze = async () => {
    if (!file) return toast.error("Please upload a resume first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_role", jobRole || "Software Engineer");
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/upload-resume", formData);
      setResult(res.data.result);
      let count = 0;
const target = res.data.result.score;
const timer = setInterval(() => {
  count += 2;
  setDisplayScore(count);
  if (count >= target) { setDisplayScore(target); clearInterval(timer); }
}, 20);
      await refreshUser();
      toast.success("Analysis complete! 🎉");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Analysis failed. Try again.");
    } finally { setLoading(false); }
  };

  const handleRewrite = async () => {
    if (!file) return toast.error("Upload resume first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_role", jobRole || "Software Engineer");
    setRewriteLoading(true);
    try {
      const res = await api.post("/rewrite", formData);
      setRewritten(res.data.rewritten_resume);
      toast.success("Resume rewritten! ✨");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Rewrite failed");
    } finally { setRewriteLoading(false); }
  };

  const downloadPDF = () => {
    if (!rewritten) return toast.error("Rewrite resume first");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 22;
    let isFirstLine = true;

    const lines = rewritten.split("\n");

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) { y += 3; return; }
      if (y > 272) { doc.addPage(); y = 20; }

      if (isFirstLine) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(trimmed, pageWidth / 2, y, { align: "center" });
        y += 7;
        isFirstLine = false;
      } else if (trimmed.includes("@") || trimmed.toLowerCase().includes("phone") || trimmed.toLowerCase().includes("github") || trimmed.toLowerCase().includes("linkedin") || (trimmed.includes("|") && trimmed.length < 100 && y < 40)) {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(trimmed, contentWidth);
        wrapped.forEach(wl => { doc.text(wl, pageWidth / 2, y, { align: "center" }); y += 5; });
        doc.setTextColor(0, 0, 0);
      } else if (trimmed === trimmed.toUpperCase() && trimmed.length >= 3 && trimmed.length <= 35 && !trimmed.includes("@") && !/\d{4}/.test(trimmed)) {
        y += 5;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(trimmed, margin, y);
        y += 3;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
      } else if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("▸") || trimmed.startsWith("*")) {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        const clean = "• " + trimmed.replace(/^[•\-▸]\s*/, "");
        const wrapped = doc.splitTextToSize(clean, contentWidth - 6);
        wrapped.forEach((wl, i) => { doc.text(wl, margin + (i > 0 ? 6 : 3), y); y += 5; });
      } else if ((trimmed.includes("|") || trimmed.includes("–") || trimmed.includes("—")) && trimmed.length < 80) {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const wrapped = doc.splitTextToSize(trimmed, contentWidth);
        wrapped.forEach(wl => { doc.text(wl, margin, y); y += 5.5; });
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        const wrapped = doc.splitTextToSize(trimmed, contentWidth);
        wrapped.forEach(wl => { doc.text(wl, margin, y); y += 5; });
      }

      if (y > 272) { doc.addPage(); y = 20; }
    });

    doc.save("ResumeAI-Resume.pdf");
    toast.success("ATS-Friendly PDF downloaded! 📄");
  };

  const startInterview = async () => {
    setShowChat(true);
    setChatLoading(true);
    try {
      const res = await api.post("/chat", { answer: "Start interview", history: "" });
      setMessages([{ text: res.data.next_question || "Tell me about yourself.", sender: "ai" }]);
    } catch { toast.error("Failed to start interview"); }
    finally { setChatLoading(false); }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { text: userMsg, sender: "user" }]);
    setChatLoading(true);
    try {
      const res = await api.post("/chat", {
        answer: userMsg,
        history: messages.map(m => `${m.sender}: ${m.text}`).join("\n"),
      });
      setMessages(prev => [...prev, { text: res.data.feedback, sender: "ai" }, { text: res.data.next_question, sender: "ai" }]);
    } catch { toast.error("Chat error"); }
    finally { setChatLoading(false); }
  };

  const handleJDMatch = async () => {
    if (!file) return toast.error("Upload resume first");
    if (!jdText.trim()) return toast.error("Paste job description first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_description", jdText);
    setJdLoading(true);
    try {
      const res = await api.post("/match-jd", formData);
      setJdResult(res.data.result);
      toast.success("JD Match complete! 🎯");
    } catch (err) {
      toast.error(err.response?.data?.detail || "JD Match failed");
    } finally { setJdLoading(false); }
  };

  const handleCoverLetter = async () => {
    if (!file) return toast.error("Upload resume first");
    if (!jobRole) return toast.error("Enter job role first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_role", jobRole);
    formData.append("company_name", companyName || "the company");
    setCoverLoading(true);
    try {
      const res = await api.post("/cover-letter", formData);
      setCoverLetter(res.data.cover_letter);
      toast.success("Cover letter ready! 📝");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cover letter failed");
    } finally { setCoverLoading(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/history");
      setHistory(res.data.history);
    } catch { toast.error("Failed to load history"); }
    finally { setHistoryLoading(false); }
  };

  const tabs = [
    { id: "analyze", label: "Analyze", emoji: "🔍" },
    { id: "rewrite", label: "Rewrite", emoji: "✨" },
    { id: "interview", label: "Interview", emoji: "🎤" },
    { id: "jd", label: "JD Match", emoji: "🎯" },
    { id: "cover", label: "Cover Letter", emoji: "📝" },
    { id: "history", label: "History", emoji: "📊" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,16,0.98)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Resume<span style={{ color: "#F59E0B" }}>AI</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#555" }}>👋 {user?.name?.split(" ")[0]}</div>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#666", padding: "7px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 20px" }}>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 12, overflowX: "auto", border: "1px solid rgba(255,255,255,0.06)" }}>
          {tabs.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => { setActiveTab(id); if (id === "history") fetchHistory(); }}
              style={{ padding: isMobile ? "8px 12px" : "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: isMobile ? 11 : 13, fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap", flex: "0 0 auto",
                background: activeTab === id ? "linear-gradient(135deg, #F59E0B, #F97316)" : "transparent",
                color: activeTab === id ? "#000" : "#555",
                boxShadow: activeTab === id ? "0 2px 12px rgba(245,158,11,0.3)" : "none",
              }}>
              {emoji} {!isMobile && label}
            </button>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Job Role</label>
              <input value={jobRole} onChange={e => setJobRole(e.target.value)}
                placeholder="e.g. Software Engineer"
                list="job-roles"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
              <datalist id="job-roles">
                <option value="Software Engineer" />
                <option value="Frontend Developer" />
                <option value="Backend Developer" />
                <option value="Full Stack Developer" />
                <option value="Data Scientist" />
                <option value="Data Analyst" />
                <option value="Machine Learning Engineer" />
                <option value="AI Engineer" />
                <option value="DevOps Engineer" />
                <option value="Product Manager" />
                <option value="UI/UX Designer" />
                <option value="Business Analyst" />
                <option value="Cloud Engineer" />
                <option value="Cybersecurity Analyst" />
                <option value="Android Developer" />
                <option value="iOS Developer" />
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resume (PDF)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files[0])}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#777", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          {activeTab === "analyze" && (
            <>
              <button onClick={handleAnalyze} disabled={loading}
                style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: loading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: loading ? "#444" : "#000", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} /> {loading ? "AI Analyzing..." : "Analyze My Resume"}
              </button>
              {loading && <p style={{ marginTop: 10, fontSize: 13, color: "#F59E0B" }}>⏳ AI is reading your resume — takes 20-40 seconds...</p>}
            </>
          )}

          {activeTab === "rewrite" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={handleRewrite} disabled={rewriteLoading}
                style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: rewriteLoading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: rewriteLoading ? "#444" : "#000", fontWeight: 800, cursor: rewriteLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
                {rewriteLoading ? "AI Rewriting..." : "✨ Rewrite My Resume"}
              </button>
              {rewritten && (
                <button onClick={downloadPDF}
                  style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#ccc", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Download size={14} /> Download PDF
                </button>
              )}
            </div>
          )}

          {activeTab === "interview" && !showChat && (
            <button onClick={startInterview}
              style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
              🎤 Start Mock Interview
            </button>
          )}

          {activeTab === "cover" && (
            <div>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="Company name (e.g. Google, TCS)"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />
              <button onClick={handleCoverLetter} disabled={coverLoading}
                style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: coverLoading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: coverLoading ? "#444" : "#000", fontWeight: 800, cursor: coverLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
                {coverLoading ? "Generating..." : "📝 Generate Cover Letter"}
              </button>
            </div>
          )}
        </div>

        {activeTab === "analyze" && result && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#777", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>ATS Score</span>
                <span style={{ fontWeight: 900, fontSize: 22, color: result.score >= 70 ? "#22c55e" : result.score >= 50 ? "#F59E0B" : "#ef4444" }}>{displayScore}<span style={{ fontSize: 14, color: "#444" }}>/100</span></span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${result.score}%`, background: result.score >= 70 ? "linear-gradient(90deg, #16a34a, #22c55e)" : result.score >= 50 ? "linear-gradient(90deg, #d97706, #F59E0B)" : "linear-gradient(90deg, #dc2626, #ef4444)", transition: "width 1s ease" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 12, padding: 16 }}>
                <h3 style={{ color: "#22c55e", fontSize: 14, marginBottom: 14, fontWeight: 700 }}>✅ Strengths</h3>
                {result.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#aaa", marginBottom: 10, display: "flex", gap: 8 }}>
                    <CheckCircle size={13} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />{s}
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 12, padding: 16 }}>
                <h3 style={{ color: "#F59E0B", fontSize: 14, marginBottom: 14, fontWeight: 700 }}>⚠️ Improvements</h3>
                {result.improvements?.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#aaa", marginBottom: 10, display: "flex", gap: 8 }}>
                    <AlertCircle size={13} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />{s}
                  </div>
                ))}
              </div>
            </div>

            {result.missing_keywords?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12, color: "#ef4444", fontWeight: 700 }}>❌ Missing Keywords</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.missing_keywords.map((k, i) => (
                    <span key={i} style={{ padding: "5px 12px", borderRadius: 99, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", fontSize: 12, color: "#ef4444" }}>{k}</span>
                  ))}
                </div>
              </div>
            )}

            {result.improved_bullets?.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, marginBottom: 14, fontWeight: 700 }}>💡 Improved Bullet Points</h3>
                {result.improved_bullets.map((b, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#444", marginBottom: 8 }}>Before: {b.original || b.before}</div>
                    <div style={{ fontSize: 13, color: "#22c55e" }}>After: {b.improved || b.after}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 10, fontSize: 13, color: "#888" }}>
              💡 <strong style={{ color: "#F59E0B" }}>Pro Tip:</strong> Use <strong>"Rewrite"</strong> tab to fix all issues automatically!
            </div>
          </div>
        )}

        {activeTab === "rewrite" && rewritten && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800 }}>✨ AI Rewritten Resume</h3>
              <button onClick={downloadPDF} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={13} /> Download PDF
              </button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#aaa", lineHeight: 1.8, fontFamily: "inherit" }}>{rewritten}</pre>
          </div>
        )}

        {activeTab === "interview" && showChat && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
              <span style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>Mock Interview Live</span>
            </div>
            <div style={{ height: 320, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 14, lineHeight: 1.5, background: m.sender === "user" ? "linear-gradient(135deg, #F59E0B, #F97316)" : "rgba(255,255,255,0.04)", color: m.sender === "user" ? "#000" : "#bbb", border: m.sender === "ai" ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && <div style={{ color: "#555", fontSize: 13 }}>🤔 AI is thinking...</div>}
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type your answer and press Enter..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none" }}
              />
              <button onClick={sendMessage} disabled={chatLoading}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontWeight: 700 }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {activeTab === "jd" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 6 }}>🎯 Job Description Match</h3>
            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Paste job description to see how well your resume matches</p>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              style={{ width: "100%", height: 140, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <button onClick={handleJDMatch} disabled={jdLoading}
              style={{ marginTop: 12, padding: "12px 28px", borderRadius: 10, border: "none", background: jdLoading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: jdLoading ? "#444" : "#000", fontWeight: 800, cursor: jdLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
              {jdLoading ? "Matching..." : "🎯 Match My Resume"}
            </button>

            {jdResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "#777", fontWeight: 600 }}>Match Score</span>
                    <span style={{ fontWeight: 900, fontSize: 22, color: jdResult.match_score >= 70 ? "#22c55e" : "#F59E0B" }}>{jdResult.match_score}%</span>
                  </div>
                  <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${jdResult.match_score}%`, background: "linear-gradient(90deg, #d97706, #F59E0B)", transition: "width 1s ease" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <h4 style={{ color: "#22c55e", marginBottom: 10, fontSize: 13 }}>✅ Matched</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {jdResult.matched_keywords?.map((k, i) => <span key={i} style={{ padding: "4px 10px", borderRadius: 99, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", fontSize: 12, color: "#22c55e" }}>{k}</span>)}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ color: "#ef4444", marginBottom: 10, fontSize: 13 }}>❌ Missing</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {jdResult.missing_keywords?.map((k, i) => <span key={i} style={{ padding: "4px 10px", borderRadius: 99, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", fontSize: 12, color: "#ef4444" }}>{k}</span>)}
                    </div>
                  </div>
                </div>
                <div style={{ padding: 14, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 10, fontSize: 13, color: "#888" }}>
                  💡 {jdResult.recommendation}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cover" && coverLetter && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800 }}>📝 Your Cover Letter</h3>
              <button onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success("Copied!"); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 13 }}>
                📋 Copy
              </button>
              <button onClick={() => {
                const doc = new jsPDF();
                const lines = doc.splitTextToSize(coverLetter, 175);
                doc.setFont("Helvetica", "normal");
                doc.setFontSize(11);
                let y = 20;
                lines.forEach(line => {
                  if (y > 275) { doc.addPage(); y = 20; }
                  doc.text(line, 15, y);
                  y += 6;
                });
                doc.save("CoverLetter-ResumeAI.pdf");
                toast.success("Cover Letter PDF downloaded!");
              }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                📄 Download PDF
                </button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#aaa", lineHeight: 1.9, fontFamily: "inherit" }}>{coverLetter}</pre>
          </div>
        )}

        {activeTab === "history" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800 }}>📊 Resume History</h3>
              <button onClick={fetchHistory} disabled={historyLoading}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                {historyLoading ? "Loading..." : "🔄 Refresh"}
              </button>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <p>No analyses yet!</p>
                <button onClick={fetchHistory} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                  Load History
                </button>
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{h.job_role}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: "#555" }}>{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 18, color: h.score >= 70 ? "#22c55e" : h.score >= 50 ? "#F59E0B" : "#ef4444" }}>{h.score}/100</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${h.score}%`, background: h.score >= 70 ? "#22c55e" : "#F59E0B", borderRadius: 99 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}