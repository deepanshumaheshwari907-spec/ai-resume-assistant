import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardPaste,
  Clock3,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PenLine,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  X,
  ChevronRight,
  BriefcaseBusiness,
  Trash2,
} from "lucide-react";
import "../styles/dashboard.css";

const NAV_ITEMS = [
  { id: "home", label: "Overview", icon: LayoutDashboard },
  { id: "analyze", label: "Analyze Resume", icon: BarChart3 },
  { id: "jd", label: "Job Match", icon: Target },
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "rewrite", label: "Rewrite", icon: PenLine },
  { id: "cover", label: "Cover Letter", icon: FileText },
  { id: "interview", label: "Interview", icon: MessageSquareText },
  { id: "history", label: "History", icon: History },
];

const loaderTexts = [
  "Reading your resume...",
  "Analyzing core skills...",
  "Checking role alignment...",
  "Preparing your recommendations...",
];

const getScoreLabel = (score) => {
  if (score >= 80) return "Strong match";
  if (score >= 65) return "Good foundation";
  if (score >= 50) return "Needs improvement";
  return "Needs attention";
};

const getScoreTone = (score) => {
  if (score >= 80) return "success";
  if (score >= 65) return "warm";
  return "danger";
};

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [storedResume, setStoredResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [jobRole, setJobRole] = useState("AI/ML Engineer");
  const [result, setResult] = useState(null);
  const [rewritten, setRewritten] = useState(null);

  const [loading, setLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [jdLoading, setJdLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdResult, setJdResult] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [coverLetter, setCoverLetter] = useState(null);

  const [historyData, setHistoryData] = useState([]);

  const [opportunities, setOpportunities] = useState([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityActionLoading, setOpportunityActionLoading] = useState(false);
  const [applicationPackLoading, setApplicationPackLoading] = useState(false);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState({ company_name: "", job_title: "", job_description: "" });

  const [showStudentPopup, setShowStudentPopup] = useState(false);
  const [studentDetails, setStudentDetails] = useState({ age: "", branch: "" });
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [loaderText, setLoaderText] = useState(loaderTexts[0]);

  const isBusy = loading || rewriteLoading || jdLoading || coverLoading || historyLoading || opportunityLoading || opportunityActionLoading || applicationPackLoading;

  useEffect(() => {
    if (!isBusy) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % loaderTexts.length;
      setLoaderText(loaderTexts[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isBusy]);

  useEffect(() => {
    fetchLatestResume();
    fetchHistory(true);
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory(false);
    if (activeTab === "opportunities") fetchOpportunities();
  }, [activeTab]);

  const score = Number(result?.score ?? 0);
  const scoreTone = getScoreTone(score);
  const scoreLabel = getScoreLabel(score);

  const analysesUsed = Number(user?.usage_count ?? 0);
  const analysesLimit = Number(user?.analysis_limit ?? 20);
  const usagePercent = analysesLimit > 0 ? Math.min(100, (analysesUsed / analysesLimit) * 100) : 0;

  const selectedResumeName = file?.name || storedResume?.filename || "No resume selected";
  const hasResume = Boolean(file || storedResume);

  const recentHistory = useMemo(() => historyData.slice(0, 4), [historyData]);

  const goTo = (tab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const fetchLatestResume = async () => {
    setResumeLoading(true);
    try {
      const res = await api.get("/resume/latest");
      setStoredResume(res.data.resume || null);
    } catch (err) {
      console.error("Latest resume fetch failed:", err);
    } finally {
      setResumeLoading(false);
    }
  };

  const fetchHistory = async (syncLatest = false) => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/history");
      const history = res.data.history || [];
      setHistoryData(history);

      if (syncLatest && history.length) {
        try {
          const latestResult = typeof history[0].result === "string"
            ? JSON.parse(history[0].result)
            : history[0].result;
          setResult(latestResult || null);
          if (history[0].job_role) setJobRole(history[0].job_role);
        } catch (parseError) {
          console.error("Latest analysis parse failed:", parseError);
        }
      }
    } catch (err) {
      console.error("History fetch failed:", err);
      toast.error("Could not load your history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchOpportunities = async () => {
    setOpportunityLoading(true);
    try {
      const res = await api.get("/opportunities");
      const items = res.data.opportunities || [];
      setOpportunities(items);
      if (selectedOpportunity?.id) {
        const detailRes = await api.get(`/opportunities/${selectedOpportunity.id}`);
        setSelectedOpportunity(detailRes.data.opportunity || null);
      }
    } catch (err) {
      console.error("Opportunity fetch failed:", err);
      toast.error(err.response?.data?.detail || "Could not load opportunities");
    } finally {
      setOpportunityLoading(false);
    }
  };

  const openOpportunity = async (id) => {
    setOpportunityActionLoading(true);
    try {
      const res = await api.get(`/opportunities/${id}`);
      setSelectedOpportunity(res.data.opportunity || null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not open opportunity");
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const createOpportunity = async () => {
    if (!opportunityForm.company_name.trim() || !opportunityForm.job_title.trim() || !opportunityForm.job_description.trim()) {
      toast.error("Add company, role and job description");
      return;
    }
    setOpportunityActionLoading(true);
    try {
      const res = await api.post("/opportunities", {
        company_name: opportunityForm.company_name.trim(),
        job_title: opportunityForm.job_title.trim(),
        job_description: opportunityForm.job_description.trim(),
      });
      const created = res.data.opportunity;
      setOpportunityForm({ company_name: "", job_title: "", job_description: "" });
      setShowOpportunityForm(false);
      await fetchOpportunities();
      await openOpportunity(created.id);
      toast.success("Opportunity saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save opportunity");
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const updateOpportunityStatus = async (status) => {
    if (!selectedOpportunity?.id) return;
    setOpportunityActionLoading(true);
    try {
      const res = await api.patch(`/opportunities/${selectedOpportunity.id}/status`, { status });
      setSelectedOpportunity((prev) => ({ ...prev, status: res.data.opportunity.status }));
      await fetchOpportunities();
      toast.success("Status updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update status");
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const runOpportunityAction = async (action) => {
    if (!selectedOpportunity?.id) return;
    setOpportunityActionLoading(true);
    try {
      const res = await api.post(`/opportunities/${selectedOpportunity.id}/${action}`);
      const updated = res.data.opportunity;
      setSelectedOpportunity((prev) => ({ ...prev, ...updated }));
      await fetchOpportunities();
      toast.success(action === "match" ? "Opportunity matched" : action === "tailor" ? "Resume tailored" : "Cover letter generated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Opportunity action failed");
    } finally {
      setOpportunityActionLoading(false);
    }
  };


  const prepareApplication = async () => {
    if (!selectedOpportunity?.id) return;
    setApplicationPackLoading(true);
    try {
      const res = await api.post(`/opportunities/${selectedOpportunity.id}/prepare-application`);
      const updated = res.data.opportunity;
      setSelectedOpportunity((prev) => ({ ...prev, ...updated }));
      await fetchOpportunities();
      toast.success("Application pack is ready");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not prepare application");
    } finally {
      setApplicationPackLoading(false);
    }
  };

  const downloadApplicationPack = () => {
    const opportunity = selectedOpportunity;
    const pack = opportunity?.application_pack;
    if (!opportunity || !pack) return toast.error("Prepare the application first");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 16;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const addPageIfNeeded = (needed = 12) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 18;
      }
    };

    const heading = (text, size = 15) => {
      addPageIfNeeded(14);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(size);
      doc.text(text, margin, y);
      y += size * 0.55 + 4;
    };

    const body = (text, size = 10.5, gap = 5.5) => {
      const value = String(text || "").trim();
      if (!value) return;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(value, contentWidth);
      lines.forEach((line) => {
        addPageIfNeeded(gap + 1);
        doc.text(line, margin, y);
        y += gap;
      });
      y += 1;
    };

    const bulletList = (items) => {
      (items || []).forEach((item) => body(`• ${item}`, 10, 5));
    };

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RESUMEAI", margin, y);
    y += 8;
    doc.setFontSize(15);
    doc.text(`${opportunity.job_title}`, margin, y);
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(`${opportunity.company_name}  •  Application Pack`, margin, y);
    y += 8;

    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    heading("APPLICATION SNAPSHOT");
    body(`Match score: ${opportunity.match_score != null ? `${opportunity.match_score}%` : "Not calculated"}`);
    body(`Application status: ${String(opportunity.status || "saved").replace(/\b\w/g, (c) => c.toUpperCase())}`);

    const match = pack.match_result || opportunity.match_result || {};
    heading("JOB MATCH");
    if (match.recommendation) body(match.recommendation);
    if (match.matched_keywords?.length) {
      body("Matched keywords:", 10.5, 5);
      bulletList(match.matched_keywords);
    }
    if (match.missing_keywords?.length) {
      body("Missing / weak keywords:", 10.5, 5);
      bulletList(match.missing_keywords);
    }

    heading("INTERVIEW PREP");
    const interview = pack.interview_prep || {};
    if (interview.talking_points?.length) {
      body("Talking points:", 10.5, 5);
      bulletList(interview.talking_points);
    }
    if (interview.questions?.length) {
      body("Questions:", 10.5, 5);
      interview.questions.forEach((q, i) => body(`${i + 1}. ${q}`, 10, 5.5));
    }

    heading("TAILORED RESUME");
    body(pack.tailored_resume || "No tailored resume was generated.", 10, 5.2);

    heading("COVER LETTER");
    body(pack.cover_letter || "No cover letter was generated.", 10, 5.2);

    addPageIfNeeded(10);
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text("Generated by ResumeAI. Job match scores are estimates and employer hiring systems may differ.", margin, 286);

    const safeCompany = String(opportunity.company_name || "company").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const safeRole = String(opportunity.job_title || "application").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    doc.save(`${safeCompany}-${safeRole}-application-pack.pdf`);
    toast.success("Application pack PDF downloaded");
  };

  const deleteOpportunity = async () => {
    if (!selectedOpportunity?.id) return;
    if (!window.confirm("Delete this opportunity?")) return;
    setOpportunityActionLoading(true);
    try {
      await api.delete(`/opportunities/${selectedOpportunity.id}`);
      setSelectedOpportunity(null);
      await fetchOpportunities();
      toast.success("Opportunity deleted");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not delete opportunity");
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF resume");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      toast.error("Resume PDF must be 10 MB or smaller");
      return;
    }
    setFile(nextFile);
    toast.success("Resume selected");
  };

  const handleAnalyze = async () => {
    if (!hasResume) {
      toast.error("Upload a resume first");
      goTo("analyze");
      return;
    }

    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    } else if (storedResume?.id) {
      formData.append("resume_id", String(storedResume.id));
    }
    formData.append("job_role", jobRole.trim() || "Software Engineer");

    setLoading(true);
    try {
      const res = await api.post(file ? "/upload-resume" : "/analyze-saved-resume", formData);
      setResult(res.data.result);
      setRewritten(null);
      await refreshUser();
      await fetchLatestResume();
      toast.success("Resume analyzed successfully");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!hasResume) return toast.error("Upload a resume first");
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (storedResume?.id) formData.append("resume_id", String(storedResume.id));
    formData.append("job_role", jobRole.trim() || "Software Engineer");
    setRewriteLoading(true);
    try {
      const res = await api.post("/rewrite", formData);
      setRewritten(res.data.rewritten_resume);
      toast.success("Resume rewritten");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Rewrite failed");
    } finally {
      setRewriteLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!rewritten) return toast.error("Rewrite the resume first");
    const doc = new jsPDF();
    let y = 18;
    doc.setFont("Helvetica", "normal");
    const lines = doc.splitTextToSize(rewritten, 178);
    lines.forEach((line) => {
      const heading = line === line.toUpperCase() && line.length < 42 && !line.includes("@");
      doc.setFont("Helvetica", heading ? "bold" : "normal");
      doc.setFontSize(heading ? 13 : 10.5);
      doc.text(line, 16, y);
      y += heading ? 8 : 5.7;
      if (y > 278) {
        doc.addPage();
        y = 18;
      }
    });
    doc.save("resume-rewritten.pdf");
    toast.success("Resume PDF downloaded");
  };

  const handleJDMatch = async () => {
    if (!hasResume) return toast.error("Upload a resume first");
    if (!jdText.trim()) return toast.error("Paste the job description first");
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (storedResume?.id) formData.append("resume_id", String(storedResume.id));
    formData.append("job_description", jdText);
    setJdLoading(true);
    try {
      const res = await api.post("/match-jd", formData);
      setJdResult(res.data.result);
      toast.success("Job match analysis complete");
    } catch (err) {
      toast.error(err.response?.data?.detail || "JD matching failed");
    } finally {
      setJdLoading(false);
    }
  };

  const handleCoverLetter = async () => {
    if (!hasResume) return toast.error("Upload a resume first");
    if (!jobRole.trim()) return toast.error("Enter a target role first");
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (storedResume?.id) formData.append("resume_id", String(storedResume.id));
    formData.append("job_role", jobRole.trim());
    formData.append("company_name", companyName.trim() || "the company");
    setCoverLoading(true);
    try {
      const res = await api.post("/cover-letter", formData);
      setCoverLetter(res.data.cover_letter);
      toast.success("Cover letter generated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cover letter generation failed");
    } finally {
      setCoverLoading(false);
    }
  };

  const triggerInterview = () => setShowStudentPopup(true);

  const startInterview = async () => {
    if (!studentDetails.age || !studentDetails.branch) {
      toast.error("Please complete the details first");
      return;
    }
    setShowStudentPopup(false);
    setShowChat(true);
    setChatLoading(true);
    try {
      const res = await api.post("/chat", { answer: "Start interview", history: "" });
      setMessages([{ text: res.data.next_question || "Tell me about yourself.", sender: "ai" }]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not start interview");
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { text: userMsg, sender: "user" }]);
    setChatLoading(true);
    try {
      const res = await api.post("/chat", {
        answer: userMsg,
        history: messages.map((m) => `${m.sender}: ${m.text}`).join("\n"),
      });
      setMessages((prev) => [
        ...prev,
        { text: res.data.feedback, sender: "ai" },
        { text: res.data.next_question, sender: "ai" },
      ]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Interview engine failed");
    } finally {
      setChatLoading(false);
    }
  };

  const handleExitAndReport = async () => {
    try {
      toast.loading("Saving interview report...");
      const historySummary = messages.map((m) => `${m.sender}: ${m.text}`).join("\n");
      await api.post("/send-interview-report", {
        name: user?.name || "Student",
        email: user?.email || "N/A",
        age: parseInt(studentDetails.age, 10),
        branch: studentDetails.branch,
        chat_history: historySummary,
      });
      toast.dismiss();
      toast.success("Interview report sent");
    } catch (err) {
      toast.dismiss();
      toast.error(err.response?.data?.detail || "Could not send interview report");
    } finally {
      setShowChat(false);
      setMessages([]);
    }
  };

  const latestAnalysis = historyData[0] || null;
  const analysisBreakdown = useMemo(() => {
    const breakdown = result?.breakdown || result?.score_breakdown || {};
    return Object.entries(breakdown).map(([key, raw]) => {
      const scoreValue = typeof raw === "object" && raw !== null ? Number(raw.score ?? 0) : Number(raw ?? 0);
      const maxValue = typeof raw === "object" && raw !== null ? Number(raw.max ?? 0) : 0;
      return {
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        score: Number.isFinite(scoreValue) ? scoreValue : 0,
        max: Number.isFinite(maxValue) ? maxValue : 0,
        percent: maxValue > 0 ? Math.min(100, Math.max(0, (scoreValue / maxValue) * 100)) : 0,
      };
    });
  }, [result]);

  const renderScoreCard = () => (
    <section className="da-card score-card">
      <div className="score-card-top">
        <div>
          <div className="eyebrow">Resume health</div>
          <h3>{score ? `${score}/100` : "Not analyzed yet"}</h3>
          <p>{score ? scoreLabel : "Upload your resume to see your current match estimate."}</p>
          {latestAnalysis?.job_role && <span className="score-role">Latest role · {latestAnalysis.job_role}</span>}
        </div>
        <div className={`score-ring ${scoreTone}`} style={{ "--score": `${score}%` }}>
          <div className="score-ring-inner">{score ? score : "—"}</div>
        </div>
      </div>
      <div className="score-progress"><span style={{ width: `${score}%` }} /></div>
      {analysisBreakdown.length > 0 && (
        <div className="health-breakdown">
          {analysisBreakdown.map((item) => (
            <div className="health-item" key={item.key}>
              <div className="health-item-top">
                <span>{item.label}</span>
                <strong>{item.score}{item.max ? ` / ${item.max}` : ""}</strong>
              </div>
              {item.max > 0 && (
                <div className="health-mini-progress">
                  <span style={{ width: `${item.percent}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="score-footnote">
        <ShieldCheck size={15} /> Score is calculated by ResumeAI's deterministic compatibility engine; AI is used for explanations and recommendations.
      </div>
    </section>
  );

  const renderUploadPanel = (compact = false) => (
    <section className={`da-card upload-card ${compact ? "compact" : ""}`}>
      <div className="upload-copy">
        <div className="icon-box orange"><UploadCloud size={20} /></div>
        <div>
          <div className="eyebrow">Your resume</div>
          <h3>{hasResume ? "Resume ready" : "Start with your resume"}</h3>
          <p>{hasResume ? selectedResumeName : "Upload a PDF once and use it across your career tools."}</p>
        </div>
      </div>
      <div className="upload-controls">
        <input id="resume-file" type="file" accept=".pdf" onChange={handleFileChange} className="hidden-input" />
        <label htmlFor="resume-file" className="secondary-button">
          <UploadCloud size={16} /> {file ? "Change PDF" : "Choose PDF"}
        </label>
        {file ? (
          <span className="file-pill"><FileText size={14} /> {file.name}</span>
        ) : storedResume ? (
          <span className="file-pill"><CheckCircle2 size={14} /> Saved resume</span>
        ) : null}
      </div>
    </section>
  );

  const renderRoleCard = () => (
    <section className="da-card role-card">
      <div>
        <div className="eyebrow">Target role</div>
        <h3>What job are you targeting?</h3>
        <p>The role shapes your analysis and recommendations.</p>
      </div>
      <div className="role-input-row">
        <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="e.g. AI/ML Engineer" className="da-input" />
        <button className="primary-button" onClick={() => { goTo("analyze"); }}>
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );

  const renderOverview = () => (
    <div className="tab-content-active">
      <div className="hero-row">
        <div>
          <div className="eyebrow">Career workspace</div>
          <h1>Welcome back, {user?.name?.split(" ")[0] || "there"}.</h1>
          <p>Turn your resume into a stronger application—one step at a time.</p>
        </div>
        <button className="primary-button hero-cta" onClick={() => goTo("analyze")}>
          Analyze resume <ArrowRight size={17} />
        </button>
      </div>

      <div className="stats-grid">
        <section className="da-card stat-card">
          <div className="stat-icon"><BarChart3 size={18} /></div>
          <div><span>Latest score</span><strong>{score ? score : "—"}</strong></div>
          <small>{score ? scoreLabel : "No analysis yet"}</small>
        </section>
        <section className="da-card stat-card">
          <div className="stat-icon"><Clock3 size={18} /></div>
          <div><span>Analyses used</span><strong>{analysesUsed}</strong></div>
          <small>{Math.max(0, analysesLimit - analysesUsed)} remaining in development</small>
        </section>
        <section className="da-card stat-card wide-stat">
          <div className="stat-icon"><Sparkles size={18} /></div>
          <div className="stat-wide-copy"><span>Current workflow</span><strong>{hasResume ? "Resume loaded" : "Upload your resume"}</strong><small>{hasResume ? selectedResumeName : "Start by choosing a PDF."}</small></div>
          <span className={`status-dot ${hasResume ? "ready" : "pending"}`} title={hasResume ? "Resume ready" : "Resume pending"} />
          <button className="icon-button" onClick={() => goTo(file ? "analyze" : "analyze")} aria-label="Open analyze">
            <ChevronRight size={18} />
          </button>
        </section>
      </div>

      <div className="overview-grid">
        <div className="overview-main">
          {renderUploadPanel()}
          {renderRoleCard()}

          <section className="tool-grid">
            {[
              ["analyze", "Analyze", "See strengths, gaps and a compatibility estimate.", BarChart3],
              ["jd", "Job Match", "Compare your resume to a specific job description.", Target],
              ["rewrite", "Rewrite", "Make your resume clearer without inventing facts.", PenLine],
              ["cover", "Cover Letter", "Generate a role-aware first draft in seconds.", FileText],
            ].map(([id, title, desc, Icon]) => (
              <button className="tool-card" key={id} onClick={() => goTo(id)}>
                <div className="tool-card-icon"><Icon size={18} /></div>
                <div><strong>{title}</strong><span>{desc}</span></div>
                <ArrowRight size={16} className="tool-arrow" />
              </button>
            ))}
          </section>
        </div>

        <aside className="overview-side">
          {renderScoreCard()}
          <section className="da-card usage-card">
            <div className="eyebrow">Development usage</div>
            <div className="usage-number"><strong>{analysesUsed}</strong><span>/ {analysesLimit}</span></div>
            <div className="score-progress"><span style={{ width: `${usagePercent}%` }} /></div>
            <p>These limits are for development testing. Production credits will be configured separately.</p>
          </section>
          <section className="da-card latest-card">
            <div className="section-header">
              <div><div className="eyebrow">Latest activity</div><h3>{latestAnalysis ? latestAnalysis.job_role : "No analysis yet"}</h3></div>
              {latestAnalysis && <span className="soft-badge">{latestAnalysis.score}/100</span>}
            </div>
            <p>{latestAnalysis ? new Date(latestAnalysis.created_at).toLocaleString() : "Run your first analysis to build your resume history."}</p>
            <button className="text-button" onClick={() => goTo("analyze")}>
              {latestAnalysis ? "Open latest analysis" : "Start analysis"} <ArrowRight size={15} />
            </button>
          </section>
          <section className="da-card trust-card">
            <ShieldCheck size={18} />
            <div><strong>Privacy-first workflow</strong><p>Your API keys stay on the server. ResumeAI uses your resume only to power the selected tool.</p></div>
          </section>
        </aside>
      </div>

      <section className="da-card recent-card">
        <div className="section-header"><div><div className="eyebrow">Activity</div><h3>Recent analyses</h3></div><button className="text-button" onClick={() => goTo("history")}>View history <ArrowRight size={15} /></button></div>
        {!recentHistory.length ? (
          <div className="empty-state"><History size={24} /><p>Your completed analyses will appear here.</p><button className="secondary-button" onClick={() => goTo("analyze")}>Run your first analysis</button></div>
        ) : (
          <div className="history-list compact-list">
            {recentHistory.map((h) => (
              <button key={h.id} className="history-row" onClick={() => { try { setResult(typeof h.result === "string" ? JSON.parse(h.result) : h.result); } catch { setResult(null); } if (h.job_role) setJobRole(h.job_role); goTo("analyze"); }}>
                <div className="history-row-icon"><FileText size={16} /></div>
                <div className="history-row-copy"><strong>{h.job_role}</strong><span>{new Date(h.created_at).toLocaleDateString()}</span></div>
                <strong className={`history-score ${getScoreTone(h.score)}`}>{h.score}/100</strong>
                <ChevronRight size={16} className="muted-icon" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderAnalyze = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">Analyze</div><h2>Understand your resume before you apply.</h2><p>Get a transparent compatibility estimate for your selected role.</p></div></div>
      {renderUploadPanel(true)}
      {renderRoleCard()}
      <div className="action-row"><button className="primary-button" onClick={handleAnalyze} disabled={loading || !hasResume}>{loading ? <><RefreshCw size={16} className="spin" /> {loaderText}</> : <><BarChart3 size={16} /> Analyze resume</>}</button></div>
      {result && (
        <div className="result-stack">
          {renderScoreCard()}
          <div className="result-grid">
            <section className="da-card result-list-card"><div className="section-header"><div><div className="eyebrow">What is working</div><h3>Strengths</h3></div><CheckCircle2 size={18} className="success-icon" /></div>{result.strengths?.map((item, i) => <div className="bullet-row" key={i}><CheckCircle2 size={15} /> <span>{item}</span></div>)}</section>
            <section className="da-card result-list-card"><div className="section-header"><div><div className="eyebrow">What to improve</div><h3>Priority fixes</h3></div><AlertCircle size={18} className="warning-icon" /></div>{result.improvements?.map((item, i) => <div className="bullet-row warning" key={i}><AlertCircle size={15} /> <span>{item}</span></div>)}</section>
          </div>
          {!!result.missing_keywords?.length && <section className="da-card keyword-card"><div className="eyebrow">Keywords</div><h3>Missing or underrepresented terms</h3><div className="chip-wrap">{result.missing_keywords.map((item, i) => <span className="chip danger" key={i}>{item}</span>)}</div></section>}
          {!!result.improved_bullets?.length && <section className="da-card keyword-card"><div className="eyebrow">AI-assisted edits</div><h3>Bullet improvements</h3>{result.improved_bullets.map((b, i) => <div className="before-after" key={i}><div><span>Original</span><p>{b.original || b.before}</p></div><ArrowRight size={16} className="before-after-arrow" /><div className="after"><span>Improved</span><p>{b.improved || b.after}</p></div></div>)}</section>}
        </div>
      )}
    </div>
  );

  const renderRewrite = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">Rewrite</div><h2>Make your resume sharper.</h2><p>Rewrite for your target role while keeping the facts grounded in your original resume.</p></div></div>
      {renderUploadPanel(true)}
      {renderRoleCard()}
      <div className="action-row"><button className="primary-button" onClick={handleRewrite} disabled={rewriteLoading || !hasResume}>{rewriteLoading ? <><RefreshCw size={16} className="spin" /> Rewriting...</> : <><Sparkles size={16} /> Rewrite resume</>}</button>{rewritten && <button className="secondary-button" onClick={downloadPDF}><Download size={16} /> Download PDF</button>}</div>
      {rewritten && <section className="da-card document-card"><div className="document-header"><div><div className="eyebrow">Generated draft</div><h3>Rewritten resume</h3></div><span className="soft-badge">ATS-friendly formatting</span></div><pre>{rewritten}</pre></section>}
    </div>
  );

  const renderJD = () => {
    const requiredMatched = jdResult?.matched_required || [];
    const requiredMissing = jdResult?.missing_required || [];
    const preferredMatched = jdResult?.matched_preferred || [];
    const preferredMissing = jdResult?.missing_preferred || [];
    const generalMatched = jdResult?.matched_general || [];
    const generalMissing = jdResult?.missing_general || [];
    const requiredScore = jdResult?.score_breakdown?.required_skills || { score: 0, max: 70 };
    const preferredScore = jdResult?.score_breakdown?.preferred_skills || { score: 0, max: 20 };
    const generalScore = jdResult?.score_breakdown?.general_alignment || { score: 0, max: 10 };

    const SkillChips = ({ items, tone }) => (
      <div className="chip-wrap">
        {items.length ? items.map((k, i) => (
          <span className={`chip ${tone}`} key={`${k}-${i}`}>{k}</span>
        )) : <span className="jd-empty-chip">None detected</span>}
      </div>
    );

    const ScoreBar = ({ label, score: value, max }) => {
      const pct = max ? Math.round((value / max) * 100) : 0;
      return (
        <div className="jd-score-bar-row">
          <div className="jd-score-bar-meta"><span>{label}</span><strong>{value}/{max}</strong></div>
          <div className="jd-score-bar"><span style={{ width: `${pct}%` }} /></div>
        </div>
      );
    };

    return (
      <div className="tab-content-active stack-lg">
        <div className="page-heading">
          <div>
            <div className="eyebrow">Job match</div>
            <h2>See how your resume fits a specific opportunity.</h2>
            <p>Compare the role's requirements, identify gaps, and decide what to improve next.</p>
          </div>
        </div>
        {renderUploadPanel(true)}
        <section className="da-card form-card">
          <div className="field-label"><ClipboardPaste size={16} /> Job description</div>
          <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} className="da-textarea" placeholder="Paste the full job description here..." />
          <div className="form-footer">
            <span>{jdText.length}/30,000 characters</span>
            <button className="primary-button" onClick={handleJDMatch} disabled={jdLoading || !hasResume || !jdText.trim()}>
              {jdLoading ? <><RefreshCw size={16} className="spin" /> Matching...</> : <><Target size={16} /> Match this job</>}
            </button>
          </div>
        </section>

        {jdResult && (
          <div className="jd-v2-stack">
            <section className="da-card jd-result jd-hero-card">
              <div className="jd-hero-main">
                <div>
                  <div className="eyebrow">Job match estimate</div>
                  <div className="jd-hero-score-line"><h3>{jdResult.match_score}%</h3><span className={`soft-badge ${jdResult.match_score >= 70 ? "success-badge" : ""}`}>{jdResult.match_score >= 80 ? "Strong overlap" : jdResult.match_score >= 60 ? "Good overlap" : "Needs tailoring"}</span></div>
                  <p>Deterministic requirement matching based on the job description and your saved resume.</p>
                </div>
                <div className="score-ring warm" style={{ "--score": `${jdResult.match_score}%` }}>
                  <div className="score-ring-inner">{jdResult.match_score}</div>
                </div>
              </div>
              <div className="jd-breakdown-grid">
                <ScoreBar label="Required skills" score={requiredScore.score} max={requiredScore.max} />
                <ScoreBar label="Preferred skills" score={preferredScore.score} max={preferredScore.max} />
                <ScoreBar label="General alignment" score={generalScore.score} max={generalScore.max} />
              </div>
            </section>

            <div className="jd-v2-grid">
              <section className="da-card jd-skill-card">
                <div className="section-header"><div><div className="eyebrow">Core requirements</div><h3>Required skills</h3></div><span className="soft-badge">{requiredMatched.length}/{requiredMatched.length + requiredMissing.length} matched</span></div>
                <div className="jd-skill-block"><div className="jd-skill-title"><CheckCircle2 size={15} /> Matched</div><SkillChips items={requiredMatched} tone="success" /></div>
                <div className="jd-skill-block"><div className="jd-skill-title warning"><AlertCircle size={15} /> Missing or underrepresented</div><SkillChips items={requiredMissing} tone="danger" /></div>
              </section>

              <section className="da-card jd-skill-card">
                <div className="section-header"><div><div className="eyebrow">Nice to have</div><h3>Preferred skills</h3></div><span className="soft-badge">{preferredMatched.length}/{preferredMatched.length + preferredMissing.length} matched</span></div>
                <div className="jd-skill-block"><div className="jd-skill-title"><CheckCircle2 size={15} /> Matched</div><SkillChips items={preferredMatched} tone="success" /></div>
                <div className="jd-skill-block"><div className="jd-skill-title warning"><AlertCircle size={15} /> Missing or underrepresented</div><SkillChips items={preferredMissing} tone="danger" /></div>
              </section>
            </div>

            {(generalMatched.length || generalMissing.length) ? (
              <section className="da-card jd-skill-card">
                <div className="section-header"><div><div className="eyebrow">Additional signals</div><h3>General alignment</h3></div></div>
                <div className="result-grid">
                  <div><div className="jd-skill-title"><CheckCircle2 size={15} /> Matched</div><SkillChips items={generalMatched} tone="success" /></div>
                  <div><div className="jd-skill-title warning"><AlertCircle size={15} /> Missing</div><SkillChips items={generalMissing} tone="danger" /></div>
                </div>
              </section>
            ) : null}

            <section className="da-card recommendation jd-action-card">
              <div className="jd-action-icon"><Sparkles size={18} /></div>
              <div className="jd-action-copy"><div className="eyebrow">Recommended next step</div><h3>{jdResult.recommendation}</h3><p>ResumeAI does not invent skills or experience. Use only evidence you genuinely have when tailoring your resume.</p></div>
              <button className="primary-button" onClick={() => goTo("rewrite")}><PenLine size={16} /> Improve my resume</button>
            </section>
          </div>
        )}
      </div>
    );
  };

  const renderCover = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">Cover letter</div><h2>Start with a role-specific first draft.</h2><p>Use your resume evidence and the company name to create a focused letter.</p></div></div>
      {renderUploadPanel(true)}
      {renderRoleCard()}
      <section className="da-card form-card"><div className="field-label"><FileText size={16} /> Company</div><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="da-input" placeholder="e.g. Acme, Microsoft, Infosys" /><div className="form-footer"><span>Keep it specific to the opportunity.</span><button className="primary-button" onClick={handleCoverLetter} disabled={coverLoading || !hasResume}>{coverLoading ? <><RefreshCw size={16} className="spin" /> Generating...</> : <><Sparkles size={16} /> Generate letter</>}</button></div></section>
      {coverLetter && <section className="da-card document-card"><div className="document-header"><div><div className="eyebrow">Draft</div><h3>Your cover letter</h3></div><button className="secondary-button small" onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success("Copied to clipboard"); }}>Copy</button></div><pre>{coverLetter}</pre></section>}
    </div>
  );

  const renderInterview = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">Interview</div><h2>Practice before the real conversation.</h2><p>Start a guided mock interview and get feedback after each answer.</p></div></div>
      {!showChat ? (
        <section className="da-card interview-start"><div className="interview-visual"><MessageSquareText size={28} /></div><div><div className="eyebrow">Personalized practice</div><h3>Ready for a mock interview?</h3><p>We will use your answers to keep the conversation practical and role-focused.</p><button className="primary-button" onClick={triggerInterview}><Play size={16} /> Start interview</button></div></section>
      ) : (
        <section className="da-card interview-card"><div className="interview-header"><div><div className="eyebrow">Live session</div><h3>Mock interview</h3></div><button className="danger-button" onClick={handleExitAndReport}><X size={15} /> End session</button></div><div className="chat-window">{messages.map((m, i) => <div key={i} className={`chat-row ${m.sender === "user" ? "user" : "ai"}`}><div className="chat-bubble">{m.text}</div></div>)}{chatLoading && <div className="chat-thinking"><Sparkles size={15} /> AI is thinking...</div>}</div><div className="chat-input-row"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder="Type your answer..." disabled={chatLoading} /><button className="primary-button icon-only" onClick={sendMessage} disabled={chatLoading}><Send size={17} /></button></div></section>
      )}
    </div>
  );

  const renderOpportunities = () => {
    const statusLabels = {
      saved: "Saved",
      analyzed: "Analyzed",
      tailored: "Tailored",
      applied: "Applied",
      interview: "Interview",
      offer: "Offer",
      closed: "Closed",
    };

    return (
      <div className="tab-content-active stack-lg">
        <div className="page-heading opportunity-heading">
          <div>
            <div className="eyebrow">Application workspace</div>
            <h2>Turn job descriptions into complete applications.</h2>
            <p>Save an opportunity once, then match, tailor, write, and track it from one place.</p>
          </div>
          <button className="primary-button" onClick={() => setShowOpportunityForm((v) => !v)}>
            <BriefcaseBusiness size={16} /> {showOpportunityForm ? "Close" : "New opportunity"}
          </button>
        </div>

        {showOpportunityForm && (
          <section className="da-card opportunity-form-card">
            <div className="eyebrow">Create opportunity</div>
            <div className="opportunity-form-grid">
              <input className="da-input" value={opportunityForm.company_name} onChange={(e) => setOpportunityForm((p) => ({ ...p, company_name: e.target.value }))} placeholder="Company name" />
              <input className="da-input" value={opportunityForm.job_title} onChange={(e) => setOpportunityForm((p) => ({ ...p, job_title: e.target.value }))} placeholder="Job title" />
            </div>
            <textarea className="da-textarea opportunity-form-textarea" value={opportunityForm.job_description} onChange={(e) => setOpportunityForm((p) => ({ ...p, job_description: e.target.value }))} placeholder="Paste the complete job description here..." />
            <div className="form-footer"><span>{opportunityForm.job_description.length}/30,000 characters</span><button className="primary-button" onClick={createOpportunity} disabled={opportunityActionLoading}><Sparkles size={16} /> Save opportunity</button></div>
          </section>
        )}

        <div className="opportunity-layout">
          <section className="da-card opportunity-list-card">
            <div className="section-header">
              <div><div className="eyebrow">Pipeline</div><h3>My opportunities</h3></div>
              <span className="soft-badge">{opportunities.length} saved</span>
            </div>
            {opportunityLoading ? (
              <div className="empty-state"><RefreshCw size={24} className="spin" /><p>Loading opportunities...</p></div>
            ) : !opportunities.length ? (
              <div className="empty-state"><BriefcaseBusiness size={24} /><p>No opportunities yet.</p><button className="secondary-button" onClick={() => setShowOpportunityForm(true)}>Save your first job</button></div>
            ) : (
              <div className="opportunity-list">
                {opportunities.map((item) => (
                  <button key={item.id} className={`opportunity-row ${selectedOpportunity?.id === item.id ? "selected" : ""}`} onClick={() => openOpportunity(item.id)}>
                    <div className="opportunity-company-mark">{(item.company_name || "C").charAt(0).toUpperCase()}</div>
                    <div className="opportunity-row-copy"><strong>{item.job_title}</strong><span>{item.company_name}</span></div>
                    <div className="opportunity-row-meta"><span className={`status-pill status-${item.status}`}>{statusLabels[item.status] || item.status}</span>{item.match_score != null && <strong>{item.match_score}%</strong>}</div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="da-card opportunity-detail-card">
            {!selectedOpportunity ? (
              <div className="opportunity-empty-detail">
                <div className="opportunity-detail-icon"><BriefcaseBusiness size={25} /></div>
                <div className="eyebrow">Opportunity workspace</div>
                <h3>Select a job to begin.</h3>
                <p>Save a role, then build the full application around it.</p>
              </div>
            ) : (
              <>
                <div className="opportunity-detail-top">
                  <div>
                    <div className="eyebrow">{selectedOpportunity.company_name}</div>
                    <h3>{selectedOpportunity.job_title}</h3>
                    <p>Created {new Date(selectedOpportunity.created_at).toLocaleDateString()}</p>
                  </div>
                  <button className="icon-button danger-icon-button" onClick={deleteOpportunity} aria-label="Delete opportunity"><Trash2 size={17} /></button>
                </div>

                <div className="opportunity-status-row">
                  <label>Application status</label>
                  <select value={selectedOpportunity.status} onChange={(e) => updateOpportunityStatus(e.target.value)} disabled={opportunityActionLoading} className="status-select">
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>

                <div className="opportunity-score-panel">
                  <div><span>Job match</span><strong>{selectedOpportunity.match_score != null ? `${selectedOpportunity.match_score}%` : "—"}</strong><small>{selectedOpportunity.match_score != null ? "Saved match result" : "Not matched yet"}</small></div>
                  <div className="opportunity-actions">
                    <button className="secondary-button small" onClick={() => runOpportunityAction("match")} disabled={opportunityActionLoading}><Target size={15} /> Match</button>
                    <button className="primary-button small" onClick={() => runOpportunityAction("tailor")} disabled={opportunityActionLoading}><PenLine size={15} /> Tailor</button>
                    <button className="secondary-button small" onClick={() => runOpportunityAction("cover-letter")} disabled={opportunityActionLoading}><FileText size={15} /> Cover letter</button>
                    <button className="primary-button small pack-button" onClick={prepareApplication} disabled={opportunityActionLoading || applicationPackLoading}>
                      {applicationPackLoading ? <><RefreshCw size={15} className="spin" /> Preparing...</> : <><Sparkles size={15} /> Prepare application</>}
                    </button>
                  </div>
                </div>

                {selectedOpportunity.application_pack && (
                  <div className="opportunity-section application-pack-section">
                    <div className="section-header">
                      <div>
                        <div className="eyebrow">Application pack</div>
                        <h3>Everything ready for this opportunity</h3>
                      </div>
                      <button className="secondary-button small" onClick={downloadApplicationPack}>
                        <Download size={15} /> Download pack
                      </button>
                    </div>

                    <div className="pack-checklist">
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Job match</strong><small>{selectedOpportunity.match_score ?? "—"}% saved</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Tailored resume</strong><small>Ready</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Cover letter</strong><small>Ready</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Interview prep</strong><small>{selectedOpportunity.application_pack.interview_prep?.questions?.length || 0} questions</small></span></div>
                    </div>

                    {!!selectedOpportunity.application_pack.interview_prep?.questions?.length && (
                      <div className="pack-subsection">
                        <span className="opp-label">Interview questions</span>
                        <div className="pack-questions">
                          {selectedOpportunity.application_pack.interview_prep.questions.slice(0, 8).map((q, i) => (
                            <div className="pack-question" key={`${q}-${i}`}><span>{i + 1}</span><p>{q}</p></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!!selectedOpportunity.application_pack.interview_prep?.talking_points?.length && (
                      <div className="pack-subsection">
                        <span className="opp-label">Talking points</span>
                        <div className="pack-talking-points">
                          {selectedOpportunity.application_pack.interview_prep.talking_points.map((item, i) => (
                            <div className="bullet-row" key={`${item}-${i}`}><CheckCircle2 size={15} /> <span>{item}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedOpportunity.match_result && (
                  <div className="opportunity-section">
                    <div className="section-header"><div><div className="eyebrow">Requirement intelligence</div><h3>What this role needs</h3></div></div>
                    <div className="opp-result-grid">
                      <div><span className="opp-label success-text">Matched</span><div className="chip-wrap">{(selectedOpportunity.match_result.matched_keywords || selectedOpportunity.match_result.matched_required || []).map((k, i) => <span className="chip success" key={`${k}-${i}`}>{k}</span>)}</div></div>
                      <div><span className="opp-label danger-text">Missing / weak</span><div className="chip-wrap">{(selectedOpportunity.match_result.missing_keywords || selectedOpportunity.match_result.missing_required || []).map((k, i) => <span className="chip danger" key={`${k}-${i}`}>{k}</span>)}</div></div>
                    </div>
                    {selectedOpportunity.match_result.recommendation && <div className="recommendation"><Sparkles size={15} /><span>{selectedOpportunity.match_result.recommendation}</span></div>}
                  </div>
                )}

                {selectedOpportunity.tailored_resume && (
                  <div className="opportunity-section"><div className="section-header"><div><div className="eyebrow">Tailored asset</div><h3>Resume draft ready</h3></div><span className="soft-badge">Saved</span></div><pre className="opportunity-document-preview">{selectedOpportunity.tailored_resume.slice(0, 2600)}{selectedOpportunity.tailored_resume.length > 2600 ? "\n\n…" : ""}</pre></div>
                )}

                {selectedOpportunity.cover_letter && (
                  <div className="opportunity-section"><div className="section-header"><div><div className="eyebrow">Application asset</div><h3>Cover letter ready</h3></div><button className="secondary-button small" onClick={() => { navigator.clipboard.writeText(selectedOpportunity.cover_letter); toast.success("Cover letter copied"); }}>Copy</button></div><pre className="opportunity-document-preview">{selectedOpportunity.cover_letter}</pre></div>
                )}

                <div className="opportunity-section"><div className="eyebrow">Job description</div><div className="job-description-preview">{selectedOpportunity.job_description}</div></div>
              </>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">History</div><h2>Your previous resume analyses.</h2><p>Keep track of roles you tested and revisit the recommendations.</p></div><button className="secondary-button" onClick={fetchHistory} disabled={historyLoading}><RefreshCw size={15} className={historyLoading ? "spin" : ""} /> Refresh</button></div>
      <section className="da-card history-card">
        {historyLoading ? <div className="empty-state"><RefreshCw size={24} className="spin" /><p>Loading history...</p></div> : !historyData.length ? <div className="empty-state"><History size={24} /><p>No analyses yet.</p><button className="secondary-button" onClick={() => goTo("analyze")}>Analyze a resume</button></div> : <div className="history-list">{historyData.map((h) => <button key={h.id} className="history-row" onClick={() => { try { setResult(typeof h.result === "string" ? JSON.parse(h.result) : h.result); } catch { setResult(null); } goTo("analyze"); }}><div className="history-row-icon"><FileText size={16} /></div><div className="history-row-copy"><strong>{h.job_role}</strong><span>{new Date(h.created_at).toLocaleString()}</span></div><strong className={`history-score ${getScoreTone(h.score)}`}>{h.score}/100</strong><ChevronRight size={16} className="muted-icon" /></button>)}</div>}
      </section>
    </div>
  );

  const renderActive = () => {
    switch (activeTab) {
      case "analyze": return renderAnalyze();
      case "jd": return renderJD();
      case "opportunities": return renderOpportunities();
      case "rewrite": return renderRewrite();
      case "cover": return renderCover();
      case "interview": return renderInterview();
      case "history": return renderHistory();
      default: return renderOverview();
    }
  };

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand-block"><div className="brand-mark">R</div><div><strong>Resume<span>AI</span></strong><small>Career workspace</small></div></div>
        <nav className="side-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} className={`side-nav-item ${activeTab === id ? "active" : ""}`} onClick={() => goTo(id)}><Icon size={17} /><span>{label}</span>{activeTab === id && <span className="active-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-user"><div className="avatar">{(user?.name || "U").charAt(0).toUpperCase()}</div><div><strong>{user?.name || "User"}</strong><small>{user?.email || ""}</small></div></div>
          <button className="logout-button" onClick={handleLogout}><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="mobile-brand">Resume<span>AI</span></div><div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{NAV_ITEMS.find((item) => item.id === activeTab)?.label || "Overview"}</strong></div></div>
          <div className="topbar-right"><span className="plan-badge"><Sparkles size={13} /> {user?.plan === "pro" ? "Pro" : "Free"}</span><div className="mini-user"><span>{user?.name || "User"}</span><div className="avatar small">{(user?.name || "U").charAt(0).toUpperCase()}</div></div></div>
        </header>

        {isBusy && <div className="loading-bar"><span /><div><strong>{activeTab === "history" ? "Loading your history..." : loaderText}</strong><small>Please keep this page open.</small></div></div>}

        <div className="dashboard-content">
          {renderActive()}
        </div>
      </main>

      {showStudentPopup && (
        <div className="modal-backdrop" onMouseDown={() => setShowStudentPopup(false)}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowStudentPopup(false)} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon"><MessageSquareText size={20} /></div>
            <div className="eyebrow">Interview setup</div>
            <h3>Tell us a little about you.</h3>
            <p>This helps us keep the interview experience appropriate to your background.</p>
            <label>Age<input type="number" value={studentDetails.age} onChange={(e) => setStudentDetails((prev) => ({ ...prev, age: e.target.value }))} placeholder="22" /></label>
            <label>Academic branch<input value={studentDetails.branch} onChange={(e) => setStudentDetails((prev) => ({ ...prev, branch: e.target.value }))} placeholder="CSE / AIML / IT" /></label>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setShowStudentPopup(false)}>Cancel</button><button className="primary-button" onClick={startInterview}>Begin interview <ArrowRight size={16} /></button></div>
          </div>
        </div>
      )}
    </div>
  );
}
