import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import { LogOut, Zap, Download, Crown, CheckCircle, AlertCircle, Send } from "lucide-react";

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

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

  const isPro = user?.plan === "pro" || user?.plan === "elite";
  const usageLeft = Math.max(0, 2 - (user?.usage_count || 0));

  const handleLogout = () => { logout(); navigate("/"); };

  const handleAnalyze = async () => {
    if (!file) return toast.error("Please upload a resume");
    if (usageLeft <= 0 && !isPro) return toast.error("Free limit reached — upgrade to Pro");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_role", jobRole || "Software Engineer");
    setLoading(true);
    try {
      const res = await api.post("/upload-resume", formData);
      setResult(res.data.result);
      setRewritten(null);
      await refreshUser();
      toast.success("Analysis complete!");
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
      toast.success("Resume rewritten!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Rewrite failed");
    } finally { setRewriteLoading(false); }
  };

  const downloadPDF = () => {
    if (!rewritten) return toast.error("Rewrite resume first");
    const doc = new jsPDF();
    let y = 20;
    doc.setFont("Times", "Normal");
    const lines = doc.splitTextToSize(rewritten, 180);
    lines.forEach((line) => {
      if (line === line.toUpperCase() && line.length < 40 && !line.includes("@")) {
        doc.setFont("Times", "Bold"); doc.setFontSize(14);
        doc.text(line, 15, y); y += 8;
        doc.setFont("Times", "Normal"); doc.setFontSize(11);
      } else {
        doc.setFontSize(11); doc.text(line, 15, y); y += 6;
      }
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save("resume-rewritten.pdf");
    toast.success("PDF downloaded!");
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
      setMessages(prev => [
        ...prev,
        { text: res.data.feedback, sender: "ai" },
        { text: res.data.next_question, sender: "ai" },
      ]);
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
      toast.success("JD Match complete!");
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
      toast.success("Cover letter ready!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cover letter failed");
    } finally { setCoverLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,15,0.98)" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Resume<span style={{ color: "#F59E0B" }}>AI</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
           {!isPro && (
            <div style={{ fontSize: 13, color: "#666", background: "#13131A", padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: usageLeft > 0 ? "#F59E0B" : "#ef4444" }}>{usageLeft}</span> / 2 free left
            </div>
          )}
          {isPro && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#F59E0B", background: "rgba(245,158,11,0.1)", padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.2)" }}>
              <Crown size={13} /> Pro Plan
            </div>
          )}
          <div style={{ fontSize: 14, color: "#999" }}>{user?.name}</div>
          <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#666", padding: "7px 14px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>

      

        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#13131A", padding: 4, borderRadius: 10, overflowX: "auto", whiteSpace: "nowrap" }}>
          {[["analyze", "Analyze"], ["rewrite", "Rewrite ✨"], ["interview", "Interview 🎤"], ["jd", "JD Match 🎯"], ["cover", "Cover Letter 📝"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.15s", background: activeTab === tab ? "#F59E0B" : "transparent", color: activeTab === tab ? "#000" : "#666" }}>
              {label} 
            </button>
          ))}
        </div>

        <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: "#999", display: "block", marginBottom: 8 }}>Job Role</label>
              <input value={jobRole} onChange={e => setJobRole(e.target.value)}
                placeholder="e.g. Software Engineer"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#999", display: "block", marginBottom: 8 }}>Resume (PDF)</label>
              <input type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files[0])}
                style={{ width: "100%", padding: "9px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          {activeTab === "analyze" && (
            <button onClick={handleAnalyze} disabled={loading}
              style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: loading ? "#333" : "#F59E0B", color: loading ? "#666" : "#000", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={16} /> {loading ? "⚡ AI Analysis in progress... Please wait 30s" : "Analyze Resume"}
            </button>
          )}

          {activeTab === "rewrite" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleRewrite} disabled={rewriteLoading}
                style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: rewriteLoading ? "#333" : "#F59E0B", color: rewriteLoading ? "#666" : "#000", fontWeight: 700, cursor: rewriteLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
                {rewriteLoading ? "Rewriting..." : "✨ Rewrite Resume"}
              </button>
              {rewritten && (
                <button onClick={downloadPDF}
                  style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Download size={15} /> Download PDF
                </button>
              )}
            </div>
          )}

          {activeTab === "interview" && !showChat && (
            <button onClick={startInterview}
              style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              🎤 Start Mock Interview
            </button>
          )}

          {activeTab === "cover" && (
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Company name (e.g. Google, Infosys)"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
          )}
        </div>

        {activeTab === "analyze" && result && (
          <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#999", fontSize: 14 }}>ATS Score</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: result.score >= 70 ? "#22c55e" : result.score >= 50 ? "#F59E0B" : "#ef4444" }}>{result.score}/100</span>
              </div>
              <div style={{ height: 8, background: "#1a1a2a", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${result.score}%`, background: result.score >= 70 ? "#22c55e" : result.score >= 50 ? "#F59E0B" : "#ef4444", transition: "width 0.8s ease" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <h3 style={{ color: "#22c55e", fontSize: 15, marginBottom: 12 }}>✅ Strengths</h3>
                {result.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", marginBottom: 8, display: "flex", gap: 8 }}>
                    <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />{s}
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ color: "#F59E0B", fontSize: 15, marginBottom: 12 }}>⚠️ Improvements</h3>
                {result.improvements?.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#ccc", marginBottom: 8, display: "flex", gap: 8 }}>
                    <AlertCircle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />{s}
                  </div>
                ))}
              </div>
            </div>
            {result.missing_keywords?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12, color: "#ef4444" }}>❌ Missing Keywords</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.missing_keywords.map((k, i) => (
                    <span key={i} style={{ padding: "4px 12px", borderRadius: 99, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#ef4444" }}>{k}</span>
                  ))}
                </div>
              </div>
            )}
            {result.improved_bullets?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>💡 Improved Bullet Points</h3>
                {result.improved_bullets.map((b, i) => (
                  <div key={i} style={{ background: "#0A0A0F", borderRadius: 8, padding: 14, marginBottom: 10, fontSize: 13 }}>
                    <div style={{ color: "#666", marginBottom: 6 }}>Before: {b.original || b.before}</div>
                    <div style={{ color: "#22c55e" }}>After: {b.improved || b.after}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rewrite" && rewritten && (
          <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>✨ Rewritten Resume</h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#ccc", lineHeight: 1.7, fontFamily: "inherit" }}>{rewritten}</pre>
          </div>
        )}

        {activeTab === "interview" && showChat && (
          <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "#999" }}>🎤 Mock Interview Session</div>
            <div style={{ height: 340, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 10, fontSize: 14, lineHeight: 1.5, background: m.sender === "user" ? "#F59E0B" : "#1a1a2a", color: m.sender === "user" ? "#000" : "#ccc" }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && <div style={{ color: "#555", fontSize: 13 }}>AI is thinking...</div>}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type your answer and press Enter..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none" }}
              />
              <button onClick={sendMessage} disabled={chatLoading}
                style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", cursor: "pointer" }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {activeTab === "jd" && (
          <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>🎯 Job Description Match</h3>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)}
              placeholder="Paste the job description here..."
              style={{ width: "100%", height: 150, padding: "12px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
            <button onClick={handleJDMatch} disabled={jdLoading}
              style={{ marginTop: 12, padding: "11px 28px", borderRadius: 8, border: "none", background: jdLoading ? "#333" : "#F59E0B", color: jdLoading ? "#666" : "#000", fontWeight: 700, cursor: jdLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
              {jdLoading ? "Matching..." : "🎯 Match Resume to JD"}
            </button>
            {jdResult && (
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#999", fontSize: 14 }}>Match Score</span>
                    <span style={{ fontWeight: 700, fontSize: 18, color: jdResult.match_score >= 70 ? "#22c55e" : jdResult.match_score >= 50 ? "#F59E0B" : "#ef4444" }}>{jdResult.match_score}%</span>
                  </div>
                  <div style={{ height: 8, background: "#1a1a2a", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${jdResult.match_score}%`, background: jdResult.match_score >= 70 ? "#22c55e" : jdResult.match_score >= 50 ? "#F59E0B" : "#ef4444", transition: "width 0.8s ease" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <h4 style={{ color: "#22c55e", marginBottom: 8 }}>✅ Matched Keywords</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {jdResult.matched_keywords?.map((k, i) => (
                        <span key={i} style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 12, color: "#22c55e" }}>{k}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ color: "#ef4444", marginBottom: 8 }}>❌ Missing Keywords</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {jdResult.missing_keywords?.map((k, i) => (
                        <span key={i} style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#ef4444" }}>{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14, fontSize: 13, color: "#ccc" }}>
                  💡 {jdResult.recommendation}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cover" && (
          <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>📝 Cover Letter Generator</h3>
            <button onClick={handleCoverLetter} disabled={coverLoading}
              style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: coverLoading ? "#333" : "#F59E0B", color: coverLoading ? "#666" : "#000", fontWeight: 700, cursor: coverLoading ? "not-allowed" : "pointer", fontSize: 14 }}>
              {coverLoading ? "Generating..." : "📝 Generate Cover Letter"}
            </button>
            {coverLetter && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4>Your Cover Letter</h4>
                  <button onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success("Copied!"); }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12 }}>
                    📋 Copy
                  </button>
                </div>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#ccc", lineHeight: 1.8, fontFamily: "inherit" }}>{coverLetter}</pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

{loading && (
  <div style={{ marginTop: 12, fontSize: 13, color: "#F59E0B", display: "flex", alignItems: "center", gap: 8 }}>
    <span>⏳</span> Our AI is reading your resume — takes about 30 seconds
  </div>
)}