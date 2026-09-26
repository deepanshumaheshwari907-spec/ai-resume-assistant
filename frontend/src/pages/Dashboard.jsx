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
import TailoredResumePreview, {
  downloadTailoredResumePdf,
  resumeToPlainText,
} from "../components/TailoredResumePreview";
import CoverLetterPreview from "../components/CoverLetterPreview";

const NAV_ITEMS = [
  { id: "home", label: "Overview", icon: LayoutDashboard },
  { id: "analyze", label: "Analyze Resume", icon: BarChart3 },
  { id: "jd", label: "Job Match", icon: Target },
  { id: "opportunities", label: "Application Tracker", icon: BriefcaseBusiness },
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

/* RESUMEAI_KANBAN_V1 */
const OPPORTUNITY_STAGES = [
  { id: "saved", label: "Saved", hint: "New leads" },
  { id: "analyzed", label: "Analyzed", hint: "Match checked" },
  { id: "tailored", label: "Tailored", hint: "Application ready" },
  { id: "applied", label: "Applied", hint: "Submitted" },
  { id: "interview", label: "Interview", hint: "In process" },
  { id: "offer", label: "Offer", hint: "Received" },
  { id: "closed", label: "Closed", hint: "Archived" },
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

  /* RESUMEAI_TRACKING_V1 */
  const [trackingForm, setTrackingForm] = useState({
    application_deadline: "",
    follow_up_at: "",
    notes: "",
    source_url: "",
  });

  const [activityData, setActivityData] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  /* RESUMEAI_ANALYTICS_V1 */
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
    // These functions intentionally remain component-local because they capture current UI state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistory(false);
    if (activeTab === "opportunities") {
      fetchOpportunities();
      fetchOpportunityAnalytics();
    }
    // These functions intentionally remain component-local because they capture current UI state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try {
      const res = await api.get("/resume/latest");
      setStoredResume(res.data.resume || null);
    } catch (err) {
      console.error("Latest resume fetch failed:", err);
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
        const refreshedOpportunity = detailRes.data.opportunity || null;
        setSelectedOpportunity(refreshedOpportunity);
        syncTrackingForm(refreshedOpportunity);
        await fetchOpportunityActivity(refreshedOpportunity?.id);
      }
    } catch (err) {
      console.error("Opportunity fetch failed:", err);
      toast.error(err.response?.data?.detail || "Could not load opportunities");
    } finally {
      setOpportunityLoading(false);
    }
  };

  const fetchOpportunityActivity = async (id) => {
    if (!id) return;
    setActivityLoading(true);
    try {
      const res = await api.get(`/opportunities/${id}/activity`);
      setActivityData(res.data.activities || []);
    } catch (err) {
      console.error("Opportunity activity fetch failed:", err);
      setActivityData([]);
      toast.error(err.response?.data?.detail || "Could not load application timeline");
    } finally {
      setActivityLoading(false);
    }
  };

  /* RESUMEAI_ANALYTICS_V1 */
  const fetchOpportunityAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get("/opportunities/analytics/summary");
      setAnalyticsData(res.data.analytics || null);
    } catch (err) {
      console.error("Opportunity analytics fetch failed:", err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openOpportunity = async (id) => {
    setOpportunityActionLoading(true);
    try {
      const res = await api.get(`/opportunities/${id}`);
      const opportunity = res.data.opportunity || null;
      setSelectedOpportunity(opportunity);
      syncTrackingForm(opportunity);
      await fetchOpportunityActivity(opportunity?.id);
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

  const updateOpportunityStatusById = async (opportunityId, status) => {
    if (!opportunityId) return;

    const previousItems = opportunities;
    const previousSelected = selectedOpportunity;

    setOpportunityActionLoading(true);

    // Optimistic UI: move immediately, then persist to the backend.
    setOpportunities((prev) =>
      prev.map((item) =>
        item.id === opportunityId ? { ...item, status } : item
      )
    );

    if (selectedOpportunity?.id === opportunityId) {
      setSelectedOpportunity((prev) => (prev ? { ...prev, status } : prev));
    }

    try {
      const res = await api.patch(
        `/opportunities/${opportunityId}/status`,
        { status }
      );

      const updated = res.data.opportunity;

      setOpportunities((prev) =>
        prev.map((item) =>
          item.id === opportunityId
            ? {
                ...item,
                status: updated.status,
                updated_at: updated.updated_at,
              }
            : item
        )
      );

      if (selectedOpportunity?.id === opportunityId) {
        setSelectedOpportunity((prev) =>
          prev
            ? {
                ...prev,
                status: updated.status,
                updated_at: updated.updated_at,
              }
            : prev
        );
      }

      const label =
        OPPORTUNITY_STAGES.find((stage) => stage.id === updated.status)?.label ||
        updated.status;

      await fetchOpportunityActivity(opportunityId);
      await fetchOpportunityAnalytics();
      toast.success(`Moved to ${label}`);
    } catch (err) {
      // Restore the previous UI state if persistence fails.
      setOpportunities(previousItems);
      setSelectedOpportunity(previousSelected);
      toast.error(err.response?.data?.detail || "Could not update status");
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const updateOpportunityStatus = async (status) => {
    if (!selectedOpportunity?.id) return;
    await updateOpportunityStatusById(selectedOpportunity.id, status);
  };

  const handleKanbanDrop = async (event, status) => {
    event.preventDefault();

    const rawId = event.dataTransfer.getData("text/plain");
    const opportunityId = Number(rawId);

    if (!opportunityId) return;

    const item = opportunities.find((entry) => entry.id === opportunityId);

    if (!item || item.status === status) return;

    await updateOpportunityStatusById(opportunityId, status);
  };

  const runOpportunityAction = async (action) => {
    if (!selectedOpportunity?.id) return;
    setOpportunityActionLoading(true);
    try {
      const res = await api.post(`/opportunities/${selectedOpportunity.id}/${action}`);
      const updated = res.data.opportunity;
      setSelectedOpportunity((prev) => ({ ...prev, ...updated }));
      await fetchOpportunities();
      await fetchOpportunityActivity(selectedOpportunity.id);
      await fetchOpportunityAnalytics();
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
      await fetchOpportunityActivity(selectedOpportunity.id);
      await fetchOpportunityAnalytics();
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
    body(
      resumeToPlainText(pack.tailored_resume) ||
        "No tailored resume was generated.",
      10,
      5.2
    );

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

  const getOpportunityReadiness = (opportunity) => {
    if (!opportunity) {
      return {
        percent: 0,
        completed: 0,
        total: 5,
        next: "Select an opportunity",
        steps: {},
      };
    }

    const hasMatch = opportunity.match_score != null || Boolean(opportunity.match_result);
    const hasTailored = Boolean(opportunity.tailored_resume);
    const hasCover = Boolean(opportunity.cover_letter);
    const hasInterview = Boolean(opportunity.application_pack?.interview_prep);
    const isApplied = ["applied", "interview", "offer", "closed"].includes(opportunity.status);

    const completed = [hasMatch, hasTailored, hasCover, hasInterview, isApplied]
      .filter(Boolean).length;

    let next = "Run job match";
    if (!hasMatch) next = "Run job match";
    else if (!hasTailored) next = "Tailor your resume";
    else if (!hasCover) next = "Generate cover letter";
    else if (!hasInterview) next = "Prepare interview";
    else if (!isApplied) next = "Mark as applied";
    else next = "Keep tracking this application";


    return {
      percent: completed * 20,
      completed,
      total: 5,
      next,
      steps: {
        match: hasMatch,
        tailored: hasTailored,
        cover: hasCover,
        interview: hasInterview,
        applied: isApplied,
      },
    };
  };

  const formatTrackingDate = (value, includeTime = false) => {
    if (!value) return "Not set";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not set";

    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(date);
  };

  const getDeadlineState = (value) => {
    if (!value) return { label: "No deadline", tone: "neutral" };

    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) {
      return { label: "Invalid deadline", tone: "danger" };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const deadlineStart = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate()
    );

    const diffDays = Math.ceil((deadlineStart - todayStart) / 86400000);

    if (diffDays < 0) return { label: "Overdue", tone: "danger" };
    if (diffDays === 0) return { label: "Due today", tone: "danger" };
    if (diffDays === 1) return { label: "Due tomorrow", tone: "warm" };

    return {
      label: `${diffDays} days left`,
      tone: diffDays <= 3 ? "warm" : "neutral",
    };
  };

  const getFollowUpState = (value) => {
    if (!value) return { label: "No follow-up", tone: "neutral" };

    const followUp = new Date(value);
    if (Number.isNaN(followUp.getTime())) {
      return { label: "Invalid follow-up", tone: "danger" };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const followUpStart = new Date(
      followUp.getFullYear(),
      followUp.getMonth(),
      followUp.getDate()
    );

    const diffDays = Math.ceil((followUpStart - todayStart) / 86400000);

    if (diffDays < 0) return { label: "Follow-up overdue", tone: "danger" };
    if (diffDays === 0) return { label: "Follow up today", tone: "danger" };
    if (diffDays === 1) return { label: "Follow up tomorrow", tone: "warm" };

    return {
      label: `Follow up in ${diffDays} days`,
      tone: diffDays <= 3 ? "warm" : "neutral",
    };
  };

  const syncTrackingForm = (opportunity) => {
    if (!opportunity) return;

    setTrackingForm({
      application_deadline: opportunity.application_deadline
        ? opportunity.application_deadline.slice(0, 16)
        : "",
      follow_up_at: opportunity.follow_up_at
        ? opportunity.follow_up_at.slice(0, 16)
        : "",
      notes: opportunity.notes || "",
      source_url: opportunity.source_url || "",
    });
  };

  const saveOpportunityMetadata = async () => {
    if (!selectedOpportunity?.id) return;

    setOpportunityActionLoading(true);

    try {
      const payload = {
        application_deadline: trackingForm.application_deadline
          ? new Date(trackingForm.application_deadline).toISOString()
          : null,
        follow_up_at: trackingForm.follow_up_at
          ? new Date(trackingForm.follow_up_at).toISOString()
          : null,
        notes: trackingForm.notes || null,
        source_url: trackingForm.source_url || null,
      };

      const res = await api.patch(
        `/opportunities/${selectedOpportunity.id}/metadata`,
        payload
      );

      const updated = res.data.opportunity || {};

      const merged = {
        ...selectedOpportunity,
        ...updated,
      };

      setSelectedOpportunity(merged);
      syncTrackingForm(merged);

      setOpportunities((prev) =>
        prev.map((item) =>
          item.id === selectedOpportunity.id
            ? { ...item, ...updated }
            : item
        )
      );

      await fetchOpportunityActivity(selectedOpportunity.id);
      await fetchOpportunityAnalytics();
      toast.success("Application details saved");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Could not save application details"
      );
    } finally {
      setOpportunityActionLoading(false);
    }
  };

  const getActivityIcon = (eventType) => {
    switch (eventType) {
      case "status": return <ArrowRight size={14} />;
      case "match": return <Target size={14} />;
      case "tailor": return <PenLine size={14} />;
      case "cover": return <FileText size={14} />;
      case "prepared": return <Sparkles size={14} />;
      case "details": return <Clock3 size={14} />;
      default: return <BriefcaseBusiness size={14} />;
    }
  };

  const formatAnalyticsAction = (item) => {
    const delta = Number(item?.days_delta ?? 0);
    if (item?.overdue) {
      const days = Math.max(1, Math.ceil(Math.abs(delta)));
      return `${days} day${days === 1 ? "" : "s"} overdue`;
    }
    if (delta <= 0.5) return "Due today";
    const days = Math.ceil(delta);
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  };

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

        {/* RESUMEAI_ANALYTICS_V1 */}
        <section className="da-card analytics-v1-panel">
          <div className="analytics-v1-header">
            <div>
              <div className="eyebrow">Application intelligence</div>
              <h3>See how your application pipeline is performing.</h3>
              <p>Live metrics are calculated from the opportunities in your account.</p>
            </div>
            <button
              className="secondary-button small"
              onClick={fetchOpportunityAnalytics}
              disabled={analyticsLoading}
            >
              <RefreshCw size={14} className={analyticsLoading ? "spin" : ""} />
              {analyticsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {analyticsLoading && !analyticsData ? (
            <div className="analytics-v1-loading">
              <RefreshCw size={18} className="spin" />
              <span>Loading application insights...</span>
            </div>
          ) : (
            <>
              <div className="analytics-v1-grid">
                <div className="analytics-stat">
                  <span>Total applications</span>
                  <strong>{analyticsData?.total_opportunities ?? 0}</strong>
                </div>
                <div className="analytics-stat">
                  <span>Submitted</span>
                  <strong>{analyticsData?.submitted_count ?? 0}</strong>
                </div>
                <div className="analytics-stat">
                  <span>Interviews</span>
                  <strong>{analyticsData?.interview_count ?? 0}</strong>
                </div>
                <div className="analytics-stat">
                  <span>Offers</span>
                  <strong>{analyticsData?.offer_count ?? 0}</strong>
                </div>
                <div className="analytics-stat">
                  <span>Response rate</span>
                  <strong>{Number(analyticsData?.response_rate ?? 0).toFixed(1)}%</strong>
                </div>
                <div className="analytics-stat">
                  <span>Avg. match score</span>
                  <strong>{analyticsData?.average_match_score != null ? `${analyticsData.average_match_score}%` : "—"}</strong>
                </div>
              </div>

              <div className="analytics-v1-lower-grid">
                <div className="analytics-v1-section">
                  <div className="analytics-v1-section-heading">
                    <span>Pipeline</span>
                    <small>Current opportunities by stage</small>
                  </div>
                  <div className="analytics-pipeline-list">
                    {OPPORTUNITY_STAGES.map((stage) => {
                      const count = analyticsData?.stage_counts?.[stage.id] ?? 0;
                      const total = analyticsData?.total_opportunities ?? 0;
                      const width = total ? Math.max(4, Math.round((count / total) * 100)) : 0;
                      return (
                        <div className="analytics-pipeline-row" key={stage.id}>
                          <div className="analytics-pipeline-label">
                            <span>{stage.label}</span>
                            <strong>{count}</strong>
                          </div>
                          <div className="analytics-pipeline-track">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="analytics-v1-section">
                  <div className="analytics-v1-section-heading">
                    <span>Upcoming actions</span>
                    <small>Deadlines and follow-ups</small>
                  </div>
                  {!analyticsData?.upcoming_actions?.length ? (
                    <div className="analytics-actions-empty">
                      <CheckCircle2 size={16} />
                      <span>No upcoming deadlines or follow-ups.</span>
                    </div>
                  ) : (
                    <div className="analytics-actions-list">
                      {analyticsData.upcoming_actions.slice(0, 5).map((item, index) => (
                        <button
                          type="button"
                          className={`analytics-action-row ${item.overdue ? "overdue" : ""}`}
                          key={`${item.type}-${item.opportunity_id}-${item.date}-${index}`}
                          onClick={() => openOpportunity(item.opportunity_id)}
                        >
                          <div className="analytics-action-icon">
                            {item.type === "deadline" ? <Clock3 size={14} /> : <Send size={14} />}
                          </div>
                          <div className="analytics-action-copy">
                            <strong>{item.job_title}</strong>
                            <span>{item.company_name} · {item.type === "deadline" ? "Deadline" : "Follow-up"}</span>
                          </div>
                          <small>{formatAnalyticsAction(item)}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="da-card tracker-board-card">
          <div className="tracker-board-header">
            <div>
              <div className="eyebrow">Application tracker</div>
              <h3>Move every application through one clear pipeline.</h3>
              <p>
                Drag a job card to another stage. The change is saved to your account,
                while the detailed application workspace stays below.
              </p>
            </div>

            <div className="tracker-metrics">
              <div>
                <strong>{opportunities.length}</strong>
                <span>Total</span>
              </div>
              <div>
                <strong>
                  {opportunities.filter((item) =>
                    ["applied", "interview", "offer"].includes(item.status)
                  ).length}
                </strong>
                <span>Active</span>
              </div>
              <div>
                <strong>
                  {opportunities.filter((item) => item.status === "interview").length}
                </strong>
                <span>Interviews</span>
              </div>
              <div>
                <strong>
                  {opportunities.filter((item) => item.status === "offer").length}
                </strong>
                <span>Offers</span>
              </div>
            </div>
          </div>

          {opportunityLoading ? (
            <div className="empty-state tracker-loading">
              <RefreshCw size={24} className="spin" />
              <p>Loading your application pipeline...</p>
            </div>
          ) : (
            <div className="kanban-board">
              {OPPORTUNITY_STAGES.map((stage) => {
                const items = opportunities.filter(
                  (item) => item.status === stage.id
                );

                return (
                  <div
                    key={stage.id}
                    className="kanban-column"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleKanbanDrop(event, stage.id)}
                  >
                    <div className="kanban-column-header">
                      <div>
                        <strong>{stage.label}</strong>
                        <span>{stage.hint}</span>
                      </div>
                      <span className="kanban-count">{items.length}</span>
                    </div>

                    <div className="kanban-column-body">
                      {!items.length ? (
                        <div className="kanban-empty">Drop applications here</div>
                      ) : (
                        items.map((item) => (
                          <div
                            key={item.id}
                            className={`kanban-item ${
                              selectedOpportunity?.id === item.id ? "selected" : ""
                            }`}
                            draggable
                            role="button"
                            tabIndex={0}
                            title="Drag to change application stage"
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                "text/plain",
                                String(item.id)
                              );
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => openOpportunity(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openOpportunity(item.id);
                              }
                            }}
                          >
                            <div className="kanban-item-top">
                              <div className="kanban-company-mark">
                                {(item.company_name || "C")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              {item.match_score != null && (
                                <span
                                  className={`kanban-match ${getScoreTone(
                                    item.match_score
                                  )}`}
                                >
                                  {item.match_score}% match
                                </span>
                              )}
                            </div>

                            <strong className="kanban-title">
                              {item.job_title}
                            </strong>

                            <span className="kanban-company">
                              {item.company_name}
                            </span>

                            <div className="kanban-item-footer">
                              <span>
                                {new Date(
                                  item.updated_at || item.created_at
                                ).toLocaleDateString()}
                              </span>
                              {item.application_deadline ? (
                                <span
                                  className={`kanban-deadline ${getDeadlineState(item.application_deadline).tone}`}
                                >
                                  {getDeadlineState(item.application_deadline).label}
                                </span>
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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
                {/* RESUMEAI_WORKSPACE_V2 */}
                {(() => {
                  const readiness = getOpportunityReadiness(selectedOpportunity);
                  const steps = [
                    {
                      key: "match",
                      label: "Job match",
                      done: readiness.steps.match,
                      action: () => runOpportunityAction("match"),
                      button: "Run match",
                    },
                    {
                      key: "tailored",
                      label: "Tailored resume",
                      done: readiness.steps.tailored,
                      action: () => runOpportunityAction("tailor"),
                      button: "Tailor resume",
                    },
                    {
                      key: "cover",
                      label: "Cover letter",
                      done: readiness.steps.cover,
                      action: () => runOpportunityAction("cover-letter"),
                      button: "Create letter",
                    },
                    {
                      key: "interview",
                      label: "Interview prep",
                      done: readiness.steps.interview,
                      action: prepareApplication,
                      button: "Prepare interview",
                    },
                    {
                      key: "applied",
                      label: "Application submitted",
                      done: readiness.steps.applied,
                      action: () => updateOpportunityStatus("applied"),
                      button: "Mark applied",
                    },
                  ];

                  const continueAction = !readiness.steps.match
                    ? () => runOpportunityAction("match")
                    : !readiness.steps.tailored
                      ? () => runOpportunityAction("tailor")
                      : !readiness.steps.cover
                        ? () => runOpportunityAction("cover-letter")
                        : !readiness.steps.interview
                          ? prepareApplication
                          : () => updateOpportunityStatus("applied");

                  return (
                    <div className="workspace-v2-panel">
                      <div className="workspace-v2-top">
                        <div>
                          <div className="eyebrow">Application readiness</div>
                          <h3>{readiness.percent}% workflow complete</h3>
                          <p>Build a job-specific application in a clear step-by-step workflow.</p>
                        </div>
                        <div className="workspace-v2-percent">
                          <strong>{readiness.percent}%</strong>
                          <span>{readiness.completed}/{readiness.total} complete</span>
                        </div>
                      </div>

                      <div className="workspace-v2-progress" aria-label={`Application readiness ${readiness.percent}%`}>
                        <span style={{ width: `${readiness.percent}%` }} />
                      </div>

                      <div className="workspace-v2-next">
                        <div>
                          <span className="opp-label">Next recommended action</span>
                          <strong>{readiness.next}</strong>
                        </div>
                        {!readiness.steps.applied && (
                          <button
                            className="primary-button small"
                            onClick={continueAction}
                            disabled={opportunityActionLoading || applicationPackLoading}
                          >
                            <ArrowRight size={15} /> Continue
                          </button>
                        )}
                      </div>

                      <div className="workspace-v2-steps">
                        {steps.map((step, index) => (
                          <div
                            key={step.key}
                            className={`workspace-v2-step ${step.done ? "done" : ""}`}
                          >
                            <div className="workspace-v2-step-line">
                              <div className="workspace-v2-step-icon">
                                {step.done ? <CheckCircle2 size={15} /> : <span>{index + 1}</span>}
                              </div>
                              {index < steps.length - 1 && <div className="workspace-v2-connector" />}
                            </div>

                            <div className="workspace-v2-step-copy">
                              <strong>{step.label}</strong>
                              <span>{step.done ? "Completed" : "Not completed yet"}</span>
                            </div>

                            {!step.done && (
                              <button
                                className="secondary-button small workspace-v2-step-button"
                                onClick={step.action}
                                disabled={opportunityActionLoading || applicationPackLoading}
                              >
                                {step.button}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}


                <section className="tracking-v1-panel">
                  <div className="tracking-v1-header">
                    <div>
                      <div className="eyebrow">Application details</div>
                      <h3>Keep the important dates and context in one place.</h3>
                      <p>
                        Track the deadline, application date, next follow-up, source,
                        and your private notes for this job.
                      </p>
                    </div>

                    <div className="tracking-v1-status-stack">
                      <span className={`tracking-status-badge ${getDeadlineState(selectedOpportunity.application_deadline).tone}`}>
                        {getDeadlineState(selectedOpportunity.application_deadline).label}
                      </span>
                      <span className={`tracking-status-badge ${getFollowUpState(selectedOpportunity.follow_up_at).tone}`}>
                        {getFollowUpState(selectedOpportunity.follow_up_at).label}
                      </span>
                    </div>
                  </div>

                  <div className="tracking-v1-grid">
                    <label className="tracking-field">
                      <span>Application deadline</span>
                      <input
                        type="datetime-local"
                        value={trackingForm.application_deadline}
                        onChange={(event) =>
                          setTrackingForm((prev) => ({
                            ...prev,
                            application_deadline: event.target.value,
                          }))
                        }
                      />
                      <small>
                        {selectedOpportunity.application_deadline
                          ? formatTrackingDate(selectedOpportunity.application_deadline, true)
                          : "No deadline saved"}
                      </small>
                    </label>

                    <label className="tracking-field">
                      <span>Next follow-up</span>
                      <input
                        type="datetime-local"
                        value={trackingForm.follow_up_at}
                        onChange={(event) =>
                          setTrackingForm((prev) => ({
                            ...prev,
                            follow_up_at: event.target.value,
                          }))
                        }
                      />
                      <small>
                        {selectedOpportunity.follow_up_at
                          ? formatTrackingDate(selectedOpportunity.follow_up_at, true)
                          : "No follow-up scheduled"}
                      </small>
                    </label>

                    <div className="tracking-readonly-card">
                      <span>Applied on</span>
                      <strong>
                        {selectedOpportunity.applied_at
                          ? formatTrackingDate(selectedOpportunity.applied_at)
                          : "Not applied yet"}
                      </strong>
                      <small>
                        Recorded automatically when the job reaches Applied,
                        Interview, or Offer.
                      </small>
                    </div>

                    <label className="tracking-field">
                      <span>Application source</span>
                      <input
                        type="url"
                        value={trackingForm.source_url}
                        onChange={(event) =>
                          setTrackingForm((prev) => ({
                            ...prev,
                            source_url: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />
                      <small>
                        Save the original job posting or application link.
                      </small>
                    </label>

                    <label className="tracking-field tracking-notes-field">
                      <span>Private notes</span>
                      <textarea
                        value={trackingForm.notes}
                        onChange={(event) =>
                          setTrackingForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        maxLength={10000}
                        placeholder="Recruiter name, referral, follow-up context, questions to ask..."
                      />
                      <small>{trackingForm.notes.length}/10,000 characters</small>
                    </label>
                  </div>

                  <div className="tracking-v1-footer">
                    <div className="tracking-summary">
                      {selectedOpportunity.application_deadline && (
                        <span>
                          Deadline: {formatTrackingDate(selectedOpportunity.application_deadline)}
                        </span>
                      )}
                      {selectedOpportunity.follow_up_at && (
                        <span>
                          Follow-up: {formatTrackingDate(selectedOpportunity.follow_up_at)}
                        </span>
                      )}
                    </div>

                    <button
                      className="primary-button small"
                      onClick={saveOpportunityMetadata}
                      disabled={opportunityActionLoading}
                    >
                      {opportunityActionLoading ? (
                        <>
                          <RefreshCw size={14} className="spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Save details
                        </>
                      )}
                    </button>
                  </div>
                </section>

                <section className="timeline-v1-panel">
                  <div className="timeline-v1-header">
                    <div>
                      <div className="eyebrow">Application timeline</div>
                      <h3>Everything that happened on this application.</h3>
                      <p>Key actions are recorded automatically so you can see the application journey at a glance.</p>
                    </div>
                    <span className="soft-badge">{activityData.length} events</span>
                  </div>

                  {activityLoading ? (
                    <div className="timeline-empty"><RefreshCw size={18} className="spin" /><span>Loading timeline...</span></div>
                  ) : !activityData.length ? (
                    <div className="timeline-empty"><Clock3 size={18} /><span>No timeline events yet.</span></div>
                  ) : (
                    <div className="timeline-list">
                      {activityData.map((activity, index) => (
                        <div className="timeline-item" key={activity.id}>
                          <div className="timeline-marker-wrap">
                            <div className={`timeline-marker timeline-${activity.event_type}`}>
                              {getActivityIcon(activity.event_type)}
                            </div>
                            {index < activityData.length - 1 && <div className="timeline-line" />}
                          </div>
                          <div className="timeline-item-content">
                            <div className="timeline-item-topline">
                              <strong>{activity.title}</strong>
                              <span>{formatTrackingDate(activity.created_at, true)}</span>
                            </div>
                            {activity.details && <p>{activity.details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="workspace-v2-section-label">
                  <span>Application controls</span>
                  <small>Refresh individual assets below without rebuilding the whole application.</small>
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
                  <div className="opportunity-section tailored-resume-section">
                    <div className="section-header">
                      <div>
                        <div className="eyebrow">Tailored asset</div>
                        <h3>Professional resume ready</h3>
                        <p>Structured for clean ATS-friendly presentation and PDF export.</p>
                      </div>
                      <div className="section-header-actions">
                        <span className="soft-badge">Saved</span>
                        <button
                          className="secondary-button small"
                          onClick={() =>
                            downloadTailoredResumePdf(
                              selectedOpportunity.tailored_resume,
                              selectedOpportunity.job_title
                            )
                          }
                        >
                          <Download size={15} /> Download resume
                        </button>
                      </div>
                    </div>
                    <TailoredResumePreview
                      value={selectedOpportunity.tailored_resume}
                      targetRole={selectedOpportunity.job_title}
                    />
                  </div>
                )}

                {/* RESUMEAI_COVER_UI_V2 */}
                {selectedOpportunity.cover_letter && (
                  <div className="opportunity-section">
                    <CoverLetterPreview
                      letter={selectedOpportunity.cover_letter}
                      companyName={selectedOpportunity.company_name}
                      jobTitle={selectedOpportunity.job_title}
                      loading={opportunityActionLoading}
                      onCopy={() => {
                        navigator.clipboard.writeText(selectedOpportunity.cover_letter);
                        toast.success("Cover letter copied");
                      }}
                      onRegenerate={() => runOpportunityAction("cover-letter")}
                    />
                  </div>
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
