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
  Search,
  ListFilter,
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
  if (score >= 80) return "Strong profile";
  if (score >= 65) return "Good foundation";
  if (score >= 50) return "Needs refinement";
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
  // Role tied to the result currently being displayed; the editable target can change before re-analysis.
  const [analysisJobRole, setAnalysisJobRole] = useState("");
  const [rewritten, setRewritten] = useState(null);
  const [rewrittenJobRole, setRewrittenJobRole] = useState("");

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
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [opportunityStatusFilter, setOpportunityStatusFilter] = useState("all");
  const [opportunityView, setOpportunityView] = useState("list");
  const [opportunityDetailTab, setOpportunityDetailTab] = useState("overview");
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
    fetchOpportunities();
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
          setAnalysisJobRole(history[0].job_role || "");
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
    const pageHeight = 297;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = 280;
    let y = 20;

    const newPage = () => {
      doc.addPage();
      y = 20;
    };

    const ensureSpace = (needed = 10) => {
      if (y + needed > bottomLimit) newPage();
    };

    const sectionHeading = (text) => {
      ensureSpace(16);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(text, margin, y);
      y += 8;
    };

    const textBlock = (text, size = 10, gap = 5.1, indent = 0) => {
      const value = String(text || "").trim();
      if (!value) return;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(size);

      const lines = doc.splitTextToSize(
        value,
        contentWidth - indent
      );

      const needed = lines.length * gap + 3;
      ensureSpace(needed);

      lines.forEach((line) => {
        doc.text(line, margin + indent, y);
        y += gap;
      });

      y += 2;
    };

    const bulletList = (items = []) => {
      items.forEach((item) => {
        textBlock(`- ${item}`, 9.6, 4.8, 2);
      });
    };

    const renderPageHeader = () => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(21);
      doc.text("RESUMEAI", margin, y);
      y += 8;

      doc.setFontSize(14);
      doc.text(String(opportunity.job_title || "Application"), margin, y);
      y += 6;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `${opportunity.company_name || "Company"}  |  Application Pack`,
        margin,
        y
      );
      y += 6;

      doc.setDrawColor(215, 215, 215);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    };

    const addFooter = () => {
      const totalPages = doc.getNumberOfPages();

      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(125, 125, 125);

        doc.text(
          `ResumeAI | Application Pack | ${page}/${totalPages}`,
          margin,
          pageHeight - 8
        );

        doc.setTextColor(0, 0, 0);
      }
    };

    const match = pack.match_result || opportunity.match_result || {};
    const interview = pack.interview_prep || {};
    const tailoredResumeText =
      resumeToPlainText(pack.tailored_resume) ||
      "No tailored resume was generated.";
    const coverLetter =
      pack.cover_letter ||
      "No cover letter was generated.";

    // PAGE 1 ? APPLICATION + JOB MATCH
    renderPageHeader();

    sectionHeading("APPLICATION SNAPSHOT");
    textBlock(
      `Match score: ${
        opportunity.match_score != null
          ? `${opportunity.match_score}%`
          : "Not calculated"
      }`,
      10.2,
      5.2
    );

    textBlock(
      `Application status: ${String(
        opportunity.status || "saved"
      ).replace(/\b\w/g, (c) => c.toUpperCase())}`,
      10.2,
      5.2
    );

    sectionHeading("JOB MATCH");

    if (match.recommendation) {
      textBlock(match.recommendation, 10, 5.1);
    }

    if (match.matched_keywords?.length) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      ensureSpace(8);
      doc.text("Matched keywords", margin, y);
      y += 6;
      bulletList(match.matched_keywords);
    }

    if (match.missing_keywords?.length) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      ensureSpace(8);
      doc.text("Missing / weak keywords", margin, y);
      y += 6;
      bulletList(match.missing_keywords);
    }

    // PAGE 2 ? INTERVIEW PREP
    newPage();
    sectionHeading("INTERVIEW PREP");

    if (interview.talking_points?.length) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      ensureSpace(8);
      doc.text("Talking points", margin, y);
      y += 6;
      bulletList(interview.talking_points);
    }

    if (interview.questions?.length) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      ensureSpace(8);
      doc.text("Interview questions", margin, y);
      y += 6;

      interview.questions.forEach((question, index) => {
        textBlock(`${index + 1}. ${question}`, 9.7, 5, 0);
      });
    }

    // PAGE 3+ ? TAILORED RESUME
    newPage();
    sectionHeading("TAILORED RESUME");

    const resumeLines = String(tailoredResumeText)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    resumeLines.forEach((line) => {
      const isHeading =
        line === line.toUpperCase() &&
        line.length < 48 &&
        !line.includes("@") &&
        !line.startsWith("http");

      textBlock(
        line,
        isHeading ? 11.5 : 9.5,
        isHeading ? 5.8 : 4.8
      );
    });

    // COVER LETTER ALWAYS STARTS CLEANLY
    newPage();
    sectionHeading("COVER LETTER");

    const coverParagraphs = String(coverLetter)
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (coverParagraphs.length) {
      coverParagraphs.forEach((paragraph) => {
        textBlock(paragraph, 10, 5.4);
      });
    } else {
      textBlock(coverLetter, 10, 5.4);
    }

    addFooter();

    const safeCompany = String(
      opportunity.company_name || "company"
    )
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    const safeRole = String(
      opportunity.job_title || "application"
    )
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    doc.save(
      `${safeCompany}-${safeRole}-application-pack.pdf`
    );

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
      setAnalysisJobRole(jobRole.trim() || "Software Engineer");
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
    const targetRole = jobRole.trim() || "Software Engineer";
    if (file) formData.append("file", file);
    else if (storedResume?.id) formData.append("resume_id", String(storedResume.id));
    formData.append("job_role", targetRole);
    setRewriteLoading(true);
    try {
      const res = await api.post("/rewrite", formData);
      const rawResume = res.data.rewritten_resume;
      let resumePayload = rawResume;

      // Structured resume JSON is returned as a string to preserve compatibility
      // with the current FastAPI response contract and existing application records.
      if (typeof rawResume === "string") {
        try {
          const parsed = JSON.parse(rawResume);
          if (parsed && typeof parsed === "object" && parsed.format_version === 1) {
            resumePayload = parsed;
          }
        } catch {
          // Keep a legacy plain-text draft readable if an older backend is running.
        }
      }

      setRewritten(resumePayload);
      setRewrittenJobRole(targetRole);
      if (resumePayload && typeof resumePayload === "object" && resumePayload.format_version === 1) {
        toast.success("Structured resume ready to review");
      } else {
        toast.success("Resume draft generated");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Rewrite failed");
    } finally {
      setRewriteLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!rewritten) return toast.error("Rewrite the resume first");
    const currentRole = jobRole.trim() || "Software Engineer";
    if (rewrittenJobRole && rewrittenJobRole.trim().replace(/\s+/g, " ").toLowerCase() !== currentRole.trim().replace(/\s+/g, " ").toLowerCase()) {
      return toast.error("The target role changed. Build the tailored resume again before downloading.");
    }

    if (typeof rewritten === "object" && rewritten.format_version === 1) {
      downloadTailoredResumePdf(rewritten, rewrittenJobRole || currentRole || "Tailored Resume");
      toast.success("Formatted resume PDF downloaded");
      return;
    }

    // Backward-compatible exporter for a legacy plain-text result from an older backend.
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const topMargin = 16;
    const bottomLimit = pageHeight - 18;
    const contentWidth = pageWidth - marginX * 2;
    let y = topMargin;

    const sectionHeadings = new Set([
      "SUMMARY",
      "PROFESSIONAL SUMMARY",
      "OBJECTIVE",
      "SKILLS",
      "TECHNICAL SKILLS",
      "EXPERIENCE",
      "WORK EXPERIENCE",
      "PROJECTS",
      "EDUCATION",
      "CERTIFICATIONS",
      "CERTIFICATIONS & COURSES",
      "COURSES",
      "ACHIEVEMENTS",
    ]);

    // jsPDF's built-in Helvetica font does not reliably render Unicode bullets.
    // Convert typographic punctuation to safe ASCII before writing the PDF.
    const normalizeLine = (value) =>
      String(value || "")
        .replace(/[\u2022\u25CF\u25AA\u25E6\u2043\u2219]/g, "-")
        .replace(/[\u2010-\u2015\u2212]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u00A0/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\t/g, " ")
        .trim();

    const normalizedLines = [];
    for (const rawLine of rewritten.replace(/\r/g, "").split("\n")) {
      const line = normalizeLine(rawLine);
      if (!line) {
        if (normalizedLines.length && normalizedLines[normalizedLines.length - 1] !== "") {
          normalizedLines.push("");
        }
      } else {
        normalizedLines.push(line);
      }
    }
    while (normalizedLines[normalizedLines.length - 1] === "") normalizedLines.pop();

    const addPage = () => {
      doc.addPage();
      y = topMargin;
    };

    const ensureRoom = (neededHeight) => {
      if (y + neededHeight > bottomLimit) addPage();
    };

    const isSectionHeading = (line) =>
      sectionHeadings.has(line.replace(/:$/, "").trim().toUpperCase());

    const isDateLine = (line) =>
      /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+)?\d{4}\s*[-/]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+)?\d{4}$/i.test(line) ||
      /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-/]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+)?\d{4}$/i.test(line);

    const firstContentIndex = normalizedLines.findIndex((line) => line !== "");
    const firstSectionIndex = normalizedLines.findIndex((line) => isSectionHeading(line));

    normalizedLines.forEach((line, index) => {
      if (!line) {
        y += 1.6;
        return;
      }

      // Candidate name: slightly larger, with a small brand-colour rule.
      if (index === firstContentIndex) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(24, 29, 38);
        const wrappedName = doc.splitTextToSize(line, contentWidth);
        ensureRoom(wrappedName.length * 6.1 + 3);
        doc.text(wrappedName, marginX, y);
        y += wrappedName.length * 6.1 + 1.5;
        doc.setDrawColor(238, 158, 35);
        doc.setLineWidth(0.65);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 4.2;
        return;
      }

      // Contact details between the name and first main section.
      if (firstSectionIndex > index && index > firstContentIndex) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.7);
        doc.setTextColor(88, 96, 108);
        const lines = doc.splitTextToSize(line, contentWidth);
        ensureRoom(lines.length * 3.7 + 0.8);
        doc.text(lines, marginX, y);
        y += lines.length * 3.7 + 0.8;
        return;
      }

      if (isSectionHeading(line)) {
        ensureRoom(11.5);
        y += 2.2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.6);
        doc.setTextColor(25, 32, 43);
        doc.text(line.replace(/:$/, ""), marginX, y);
        y += 2.0;
        doc.setDrawColor(225, 229, 235);
        doc.setLineWidth(0.25);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 4.0;
        return;
      }

      // Detect project / education entries by their following date or technology line.
      const nextLine = normalizedLines.slice(index + 1).find((item) => item !== "") || "";
      const isEntryTitle =
        !/^[-*]\s*/.test(line) &&
        (isDateLine(nextLine) || /^technologies\s*:/i.test(nextLine)) &&
        line.length < 115;

      if (isEntryTitle) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(36, 43, 54);
        const lines = doc.splitTextToSize(line, contentWidth);
        ensureRoom(lines.length * 4.1 + 1.2);
        doc.text(lines, marginX, y);
        y += lines.length * 4.1 + 1.0;
        return;
      }

      if (isDateLine(line) || /^technologies\s*:/i.test(line)) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.3);
        doc.setTextColor(93, 101, 113);
        const lines = doc.splitTextToSize(line, contentWidth);
        ensureRoom(lines.length * 3.6 + 0.7);
        doc.text(lines, marginX, y);
        y += lines.length * 3.6 + 0.7;
        return;
      }

      const bulletMatch = line.match(/^[-*]\s*(.*)$/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.1);
        doc.setTextColor(38, 44, 54);
        const bulletX = marginX + 1.0;
        const textX = marginX + 5.0;
        const lines = doc.splitTextToSize(bulletText, contentWidth - 5.0);
        const lineHeight = 4.05;
        ensureRoom(lines.length * lineHeight + 0.9);
        doc.setTextColor(224, 143, 28);
        doc.text("-", bulletX, y);
        doc.setTextColor(38, 44, 54);
        doc.text(lines, textX, y);
        y += lines.length * lineHeight + 0.9;
        return;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.1);
      doc.setTextColor(38, 44, 54);
      const lines = doc.splitTextToSize(line, contentWidth);
      const lineHeight = 4.05;
      ensureRoom(lines.length * lineHeight + 0.8);
      doc.text(lines, marginX, y);
      y += lines.length * lineHeight + 0.8;
    });

    // Add compact page numbering after all content pages are known.
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(225, 229, 235);
      doc.setLineWidth(0.25);
      doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(112, 119, 130);
      doc.text("ResumeAI - Resume Draft", marginX, pageHeight - 7);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginX, pageHeight - 7, { align: "right" });
    }

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

  const radarItems = analysisBreakdown.filter((item) => item.max > 0).slice(0, 6);

  const radarPoints = (getValue) => radarItems.map((item, index) => {

    const raw = typeof getValue === "function" ? getValue(item) : getValue;

    const value = Math.max(0, Math.min(1, Number(raw) || 0));

    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / radarItems.length;

    return `${120 + Math.cos(angle) * 88 * value},${120 + Math.sin(angle) * 88 * value}`;

  }).join(" ");



  const renderScoreCard = () => (

    <section id="resume-dna-breakdown" className="da-card dna-breakdown-card">

      <div className="dna-section-heading">

        <div>

          <div className="eyebrow">Resume DNA</div>

          <h3>What makes up your score</h3>

          <p>Explore the actual categories behind your resume-health result.</p>

        </div>

        <span className="dna-section-mark"><BarChart3 size={17} /></span>

      </div>



      <div className={`dna-breakdown-layout ${radarItems.length >= 3 ? "has-radar" : ""}`}>

        <div className="dna-category-list">

          {analysisBreakdown.length ? analysisBreakdown.map((item) => (

            <div className="dna-category-item" key={item.key}>

              <div className="dna-category-top">

                <span>{item.label}</span>

                <strong>{item.score}{item.max ? ` / ${item.max}` : ""}</strong>

              </div>

              {item.max > 0 && (

                <div className="dna-category-track" role="img"

                  aria-label={`${item.label}: ${Math.round(item.percent)} percent`}>

                  <span style={{ width: `${item.percent}%` }} />

                </div>

              )}

            </div>

          )) : <p className="dna-empty-state">Category breakdown is unavailable for this result.</p>}

        </div>



        {radarItems.length >= 3 && (

          <div className="dna-radar-panel">

            <div className="dna-radar-heading">

              <div><div className="eyebrow">Profile shape</div><strong>Category map</strong></div>

              <span className="dna-radar-dot" />

            </div>

            <svg className="dna-radar-chart" viewBox="0 0 240 240" role="img"

              aria-label={`Radar chart showing ${radarItems.length} resume score categories`}>

              <title>Normalized resume category scores</title>

              {[0.25, 0.5, 0.75, 1].map((scale) => (

                <polygon key={scale} className="dna-radar-grid" points={radarPoints(scale)} />

              ))}

              {radarItems.map((item, index) => {

                const angle = -Math.PI / 2 + (Math.PI * 2 * index) / radarItems.length;

                return <line key={item.key} className="dna-radar-axis" x1="120" y1="120"

                  x2={120 + Math.cos(angle) * 88} y2={120 + Math.sin(angle) * 88} />;

              })}

              <polygon className="dna-radar-data"

                points={radarPoints((item) => item.percent / 100)} />

              {radarItems.map((item, index) => {

                const angle = -Math.PI / 2 + (Math.PI * 2 * index) / radarItems.length;

                const radius = 88 * Math.max(0, Math.min(1, item.percent / 100));

                return <circle key={item.key} className="dna-radar-point"

                  cx={120 + Math.cos(angle) * radius} cy={120 + Math.sin(angle) * radius} r="3.5" />;

              })}

            </svg>

            <p className="dna-radar-footnote">The chart uses the normalized category scores shown alongside.</p>

          </div>

        )}

      </div>



      <div className="dna-method-note"><ShieldCheck size={15} />

        Score is calculated by ResumeAI's deterministic compatibility engine; AI is used for explanations and recommendations.

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

  const renderOverview = () => {
    /* RESUMEAI_DASHBOARD_POLISH_V3 */
    const stageCounts = OPPORTUNITY_STAGES.reduce((acc, stage) => {
      acc[stage.id] = opportunities.filter((item) => item.status === stage.id).length;
      return acc;
    }, {});

    const liveOpportunity = ['offer', 'interview', 'applied', 'tailored', 'analyzed', 'saved']
      .map((status) => opportunities.find((item) => item.status === status))
      .find(Boolean) || null;

    const pipelineTotal = opportunities.filter((item) => item.status !== 'closed').length;
    const archivedOpportunityTotal = opportunities.length - pipelineTotal;
    const resumeScore = score || Number(latestAnalysis?.score || 0);
    const scorePercent = Math.min(100, Math.max(0, resumeScore));

    let nextTitle = 'Upload your resume';
    let nextCopy = 'Start by adding the resume you want ResumeAI to work from.';
    let nextAction = 'Upload resume';
    let nextHandler = () => document.getElementById('resume-file')?.click();

    if (!hasResume) {
      // First-time users should set up a resume before working on a saved role.
      nextTitle = 'Upload your resume';
      nextCopy = 'Add your resume once, then use it across analysis, tailoring and job matching.';
      nextAction = 'Upload resume';
      nextHandler = () => document.getElementById('resume-file')?.click();
    } else if (!resumeScore) {
      nextTitle = 'Run your first analysis';
      nextCopy = 'Establish a baseline so ResumeAI can show strengths and the most useful improvements.';
      nextAction = 'Analyze resume';
      nextHandler = () => goTo('analyze');
    } else if (liveOpportunity) {
      const role = liveOpportunity.job_title || 'your target role';

      if (liveOpportunity.status === 'saved') {
        nextTitle = `Match ${role}`;
        nextCopy = 'Compare your resume with this role and identify the gaps before applying.';
        nextAction = 'Open Job Match';
        nextHandler = () => goTo('jd');
      } else if (liveOpportunity.status === 'analyzed') {
        nextTitle = `Tailor ${role}`;
        nextCopy = 'Use the match signals to create a focused, role-specific resume.';
        nextAction = 'Rewrite resume';
        nextHandler = () => goTo('rewrite');
      } else if (liveOpportunity.status === 'tailored') {
        nextTitle = `Finish ${role} application`;
        nextCopy = 'Review your application materials and move this opportunity forward.';
        nextAction = 'Open tracker';
        nextHandler = () => goTo('opportunities');
      } else if (liveOpportunity.status === 'applied') {
        nextTitle = `Check in on ${role}`;
        nextCopy = 'Review your application status and keep your next follow-up up to date.';
        nextAction = 'Open tracker';
        nextHandler = () => goTo('opportunities');
      } else if (liveOpportunity.status === 'interview') {
        nextTitle = `Prepare for ${role}`;
        nextCopy = 'Practice your story and likely questions before the next interview stage.';
        nextAction = 'Practice interview';
        nextHandler = () => goTo('interview');
      } else if (liveOpportunity.status === 'offer') {
        nextTitle = `Review your ${role} offer`;
        nextCopy = 'Check the offer details and record your decision or next steps.';
        nextAction = 'Open tracker';
        nextHandler = () => goTo('opportunities');
      } else {
        nextTitle = `Follow up on ${role}`;
        nextCopy = 'Review the application timeline and choose the next step.';
        nextAction = 'Open tracker';
        nextHandler = () => goTo('opportunities');
      }
    } else {
      nextTitle = 'Review your resume';
      nextCopy = 'Your resume already has a health score. Review the analysis and choose what to improve next.';
      nextAction = 'Open analysis';
      nextHandler = () => goTo('analyze');
    }

    const pipelineStages = [
      ['saved', 'Saved'],
      ['analyzed', 'Analyzed'],
      ['tailored', 'Tailored'],
      ['applied', 'Applied'],
      ['interview', 'Interview'],
      ['offer', 'Offer'],
    ];

    return (
      <div className="dashboard-overview-v2">
        <section className="overview-v2-hero">
          <div className="overview-v2-hero-copy">
            <div className="eyebrow">Career command center</div>
            <h1>Welcome back, {user?.name?.split(' ')[0] || 'there'}.</h1>
            <p>Your applications, resume health and next move — in one place.</p>
          </div>
</section>

        <section className="overview-v2-command-grid">
          <article className="da-card overview-v2-card overview-v2-action-card">
            <div className="overview-v2-card-top"><div><div className="eyebrow">Next action</div><h3>{nextTitle}</h3></div><span className="overview-v2-index">01</span></div>
            <p>{nextCopy}</p>
            <button className="primary-button" onClick={nextHandler}>{nextAction} <ArrowRight size={16} /></button>
          </article>

          <article className="da-card overview-v2-card overview-v2-health-card">
            <div className="overview-v2-card-top">
              <div><div className="eyebrow">Resume health</div><h3>{resumeScore ? `${resumeScore}/100` : 'Not analyzed'}</h3></div>
              <div className={`overview-v2-score-ring ${resumeScore ? 'has-score' : ''}`} style={{ '--score': `${scorePercent}%` }}><span>{resumeScore || '—'}</span></div>
            </div>
            <p>{resumeScore ? getScoreLabel(resumeScore) : 'Upload and analyze your resume to establish a baseline.'}</p>
            <div className="overview-v2-line"><span style={{ width: `${scorePercent}%` }} /></div>
            <div className="overview-v2-meta-row"><span>{storedResume?.filename || 'No resume selected'}</span><button className="text-button" onClick={() => goTo('analyze')}>View report <ArrowRight size={14} /></button></div>
          </article>

          <article className="da-card overview-v2-card overview-v2-app-card">
            <div className="overview-v2-card-top"><div><div className="eyebrow">Active application</div><h3>{liveOpportunity?.job_title || 'No active opportunity'}</h3></div><span className="soft-badge">{liveOpportunity ? String(liveOpportunity.status || 'saved').toUpperCase() : 'READY'}</span></div>
            {liveOpportunity ? (
              <><p>{liveOpportunity.company_name || 'Saved opportunity'}</p><div className="overview-v2-app-detail"><span>Match</span><strong>{liveOpportunity.match_score != null ? `${liveOpportunity.match_score}%` : '—'}</strong></div><button className="secondary-button" onClick={() => goTo('opportunities')}>Open application <ArrowRight size={15} /></button></>
            ) : (
              <><p>Save a role to connect matching, tailoring and follow-ups in one place.</p><button className="secondary-button" onClick={() => goTo('opportunities')}>Open tracker <ArrowRight size={15} /></button></>
            )}
          </article>
        </section>

        <section className={`da-card overview-v2-pipeline ${pipelineTotal === 0 ? "is-empty" : "has-applications"}`}>
          <div className="overview-v2-section-head"><div><div className="eyebrow">Application pipeline</div><h3>Keep the job hunt moving.</h3></div>{pipelineTotal > 0 && <button className="text-button" onClick={() => goTo('opportunities')}>Open tracker <ArrowRight size={14} /></button>}</div>
          {pipelineTotal === 0 ? (
            <div className="overview-v2-pipeline-empty">
              <div className="overview-v2-pipeline-empty-icon"><BriefcaseBusiness size={18} aria-hidden="true" /></div>
              <div className="overview-v2-pipeline-empty-copy">
                <strong>Your pipeline starts with one role.</strong>
                <span>Save a job you are interested in, then track it from first match through interview and offer.</span>
              </div>
              <button className="secondary-button small" onClick={() => { setShowOpportunityForm(true); goTo('opportunities'); }}>Add first opportunity <ArrowRight size={14} /></button>
            </div>
          ) : (
            <div className="overview-v2-pipeline-track">
              {pipelineStages.map(([id, label], index) => (
                <div className="overview-v2-stage" key={id}>
                  <div className="overview-v2-stage-top"><span className="overview-v2-stage-number">{String(index + 1).padStart(2, '0')}</span><strong>{stageCounts[id] || 0}</strong></div>
                  <span className="overview-v2-stage-label">{label}</span>
                  {index < pipelineStages.length - 1 && <i className="overview-v2-stage-line" />}
                </div>
              ))}
            </div>
          )}
          <div className="overview-v2-pipeline-foot"><span>{pipelineTotal} active {pipelineTotal === 1 ? 'opportunity' : 'opportunities'}</span><span>{archivedOpportunityTotal ? `${archivedOpportunityTotal} closed ${archivedOpportunityTotal === 1 ? 'opportunity is' : 'opportunities are'} archived.` : pipelineTotal ? 'Closed applications stay archived in the tracker.' : 'Your pipeline will update as you add roles.'}</span></div>
        </section>

        <div className="overview-v2-lower-grid">
          <section className="da-card overview-v2-resume-center">
            <div className="overview-v2-section-head"><div><div className="eyebrow">Resume center</div><h3>Your working resume</h3></div><span className={`soft-badge ${hasResume ? 'success-badge' : ''}`}>{hasResume ? 'READY' : 'EMPTY'}</span></div>
            <div className="overview-v2-document"><div className="overview-v2-document-icon"><FileText size={20} /></div><div className="overview-v2-document-copy"><strong>{storedResume?.filename || file?.name || 'No resume uploaded yet'}</strong><span>{hasResume ? 'Available across your ResumeAI tools.' : 'Upload once and reuse it across your workflow.'}</span></div><button className="icon-button" onClick={() => document.getElementById('resume-file')?.click()} aria-label="Choose resume"><UploadCloud size={16} /></button></div>
            <div className="overview-v2-tool-row">
              <button className="tool-card compact" onClick={() => goTo('analyze')}><BarChart3 size={16} /><span>Analyze</span><ArrowRight size={14} /></button>
              <button className="tool-card compact" onClick={() => goTo('rewrite')}><PenLine size={16} /><span>Rewrite</span><ArrowRight size={14} /></button>
              <button className="tool-card compact" onClick={() => goTo('jd')}><Target size={16} /><span>Job Match</span><ArrowRight size={14} /></button>
            </div>
            <div className="overview-v2-resume-meta">
              <div><span>Current target role</span><strong>{jobRole.trim() || 'Choose a target role'}</strong></div>
              <div><span>Last analysis</span><strong>{recentHistory[0]?.created_at ? new Date(recentHistory[0].created_at).toLocaleDateString() : 'Not analyzed yet'}</strong></div>
            </div>
          </section>

          <section className="da-card overview-v2-activity">
            <div className="overview-v2-section-head"><div><div className="eyebrow">Recent activity</div><h3>What changed lately.</h3></div><button className="text-button" onClick={() => goTo('history')}>History <ArrowRight size={14} /></button></div>
            {!recentHistory.length ? (
              <div className="overview-v2-empty"><History size={20} /><strong>No analysis activity yet.</strong><span>Run your first analysis and your timeline starts here.</span></div>
            ) : (
              <div className="overview-v2-activity-list">
                {recentHistory.slice(0, 4).map((h, index) => (
                  <button className="overview-v2-activity-row" key={h.id || `${h.job_role}-${index}`} onClick={() => { try { setResult(typeof h.result === 'string' ? JSON.parse(h.result) : h.result); } catch { setResult(null); } if (h.job_role) setJobRole(h.job_role); setAnalysisJobRole(h.job_role || ""); goTo('analyze'); }}>
                    <span className="overview-v2-activity-index">{String(index + 1).padStart(2, '0')}</span><span className="overview-v2-activity-copy"><strong>{h.job_role}</strong><small>{new Date(h.created_at).toLocaleDateString()}</small></span><strong className={`history-score ${getScoreTone(h.score)}`}>{h.score}</strong><ChevronRight size={15} className="muted-icon" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="overview-v2-footer-strip"><div><ShieldCheck size={15} /><strong>Your data stays inside your workspace.</strong><span>ResumeAI keeps your application context connected across tools.</span></div><button className="secondary-button" onClick={() => goTo('opportunities')}>View application tracker <ArrowRight size={15} /></button></section>
      </div>
    );
  };

  const renderAnalyze = () => {

    const scrollToReportSection = (id) => {

      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

    };



    return (

      <div className="tab-content-active stack-lg">

        <div className="page-heading">

          <div>

            <div className="eyebrow">Analyze</div>

            <h2>Understand your resume before you apply.</h2>

            <p>Get a transparent compatibility estimate for your selected role.</p>

          </div>

        </div>



        {renderUploadPanel(true)}

        {renderRoleCard()}



        <div className="action-row">

          <button className="primary-button" onClick={handleAnalyze} disabled={loading || !hasResume}>

            {loading

              ? <><RefreshCw size={16} className="spin" /> {loaderText}</>

              : <><BarChart3 size={16} /> Analyze resume</>}

          </button>

        </div>



        {result && (

          <div className="result-stack dna-report">

            <section className="dna-hero">

              <div className="dna-hero-top">

                <div className="dna-hero-copy">

                  <div className="dna-hero-kicker"><Sparkles size={15} /> RESUME DNA <span>/</span> CAREER INTELLIGENCE</div>

                  <h2>Know what your resume is signalling.</h2>

                  <p>A clearer view of your strengths, gaps, and the next improvements worth your attention.</p>

                  <div className="dna-hero-pills">

                    <span><Target size={14} /> {analysisJobRole || jobRole || "Selected role"}</span>

                    <span><ShieldCheck size={14} /> Evidence-led score breakdown</span>

                  </div>

                </div>

                <div className="dna-score-feature">

                  <div className={`dna-main-ring ${scoreTone}`} style={{ "--score": `${score}%` }}>

                    <div className="dna-main-ring-inner"><strong>{score || "—"}</strong><span>/100</span></div>

                  </div>

                  <div className="dna-score-caption">

                    <span>RESUME HEALTH</span>

                    <strong>{score ? scoreLabel : "Analysis ready"}</strong>

                    <small>Compatibility estimate</small>

                  </div>

                </div>

              </div>



              <div className="dna-metric-strip">

                <div className="dna-metric"><span>Strength signals</span><strong>{result.strengths?.length || 0}</strong><small>What is working</small></div>

                <div className="dna-metric"><span>Priority fixes</span><strong>{result.improvements?.length || 0}</strong><small>Where to focus</small></div>

                <div className="dna-metric"><span>Keywords to review</span><strong>{result.missing_keywords?.length || 0}</strong><small>Terms to assess</small></div>

                <div className="dna-metric"><span>Bullet examples</span><strong>{result.improved_bullets?.length || 0}</strong><small>Suggested rewrites</small></div>

              </div>

            </section>



            <nav className="dna-report-nav" aria-label="Resume report sections">

              <button type="button" onClick={() => scrollToReportSection("resume-dna-breakdown")}><BarChart3 size={15} /> Resume DNA</button>

              <button type="button" onClick={() => scrollToReportSection("dna-strengths")}><CheckCircle2 size={15} /> Strengths & fixes</button>

              {!!result.missing_keywords?.length && <button type="button" onClick={() => scrollToReportSection("dna-keywords")}><Target size={15} /> Keywords</button>}

              {!!result.improved_bullets?.length && <button type="button" onClick={() => scrollToReportSection("dna-bullet-lab")}><FileText size={15} /> Bullet lab</button>}

            </nav>



            {renderScoreCard()}



            <div id="dna-strengths" className="result-grid dna-feedback-grid dna-insight-viz-grid">{/* ANALYSIS_INSIGHT_VISUALIZATION_V1 */}
              <section className="da-card result-list-card dna-feedback-card dna-strengths-card">
                <div className="dna-insight-heading">
                  <div className="dna-insight-heading-copy">
                    <div className="eyebrow">STRENGTH SIGNALS Â· {result.strengths?.length || 0} FOUND</div>
                    <h3>Your strengths, visualized</h3>
                    <p>Evidence signals found in your resume for this analysis.</p>
                  </div>
                  <div className="dna-strength-emblem" aria-hidden="true">
                    <span className="dna-strength-emblem-ring dna-strength-emblem-ring-a" />
                    <span className="dna-strength-emblem-ring dna-strength-emblem-ring-b" />
                    <span className="dna-strength-emblem-core"><CheckCircle2 size={17} /></span>
                    <span className="dna-strength-emblem-spark">+</span>
                  </div>
                </div>
                {result.strengths?.length ? (
                  <div className="dna-strength-map">
                    {result.strengths.map((item, i) => (
                      <article className="dna-strength-node" key={i} style={{ animationDelay: `${Math.min(i, 8) * 65}ms` }}>
                        <span className="dna-strength-index">{String(i + 1).padStart(2, "0")}</span>
                        <div className="dna-strength-node-copy">
                          <span className="dna-strength-node-label">STRENGTH SIGNAL</span>
                          <p>{item}</p>
                          <span className="dna-signal-pips" aria-hidden="true"><i /><i /><i /></span>
                        </div>
                        <CheckCircle2 size={15} className="dna-strength-check" />
                      </article>
                    ))}
                  </div>
                ) : <p className="dna-empty-state">No strengths were returned for this analysis.</p>}
                <div className="dna-insight-footnote"><ShieldCheck size={13} /> Based on this analysis; no extra strength scores are inferred.</div>
              </section>

              <section className="da-card result-list-card dna-feedback-card dna-opportunities-card">
                <div className="dna-insight-heading">
                  <div className="dna-insight-heading-copy">
                    <div className="eyebrow">POTENTIAL NEXT MOVES Â· {result.improvements?.length || 0} SUGGESTIONS</div>
                    <h3>Where you can level up</h3>
                    <p>Explore the suggested focus areas in the order returned by your analysis.</p>
                  </div>
                  <div className="dna-focus-emblem" aria-hidden="true"><span /><span /><span /><AlertCircle size={17} /></div>
                </div>
                {result.improvements?.length ? (
                  <div className="dna-focus-path">
                    {result.improvements.map((item, i) => (
                      <article className="dna-focus-step" key={i} style={{ animationDelay: `${Math.min(i, 8) * 75}ms` }}>
                        <span className="dna-focus-index">{String(i + 1).padStart(2, "0")}</span>
                        <div className="dna-focus-copy">
                          <span className="dna-focus-label">FOCUS AREA</span>
                          <p>{item}</p>
                        </div>
                        <span className="dna-focus-marker" aria-hidden="true"><ChevronRight size={14} /></span>
                      </article>
                    ))}
                  </div>
                ) : <p className="dna-empty-state">No improvement suggestions were returned for this analysis.</p>}
                <div className="dna-insight-footnote dna-focus-footnote"><AlertCircle size={13} /> Suggestions, not a severity ranking. Verify each one against your actual experience.</div>
              </section>
            </div>



            {!!result.missing_keywords?.length && (
              <section id="dna-keywords" className="da-card keyword-card dna-keyword-card dna-keyword-explorer">
                <div className="dna-keyword-explorer-head">
                  <div className="dna-keyword-heading-copy">
                    <div className="eyebrow">KEYWORD EXPLORER Â· {result.missing_keywords.length} TO REVIEW</div>
                    <h3>Signals worth investigating</h3>
                    <p>Open a term to ask yourself where it fits. Only add it if your experience supports it.</p>
                  </div>
                  <div className="dna-keyword-orbit" aria-hidden="true">
                    <span className="dna-keyword-orbit-ring dna-keyword-orbit-ring-one" />
                    <span className="dna-keyword-orbit-ring dna-keyword-orbit-ring-two" />
                    <span className="dna-keyword-orbit-core"><Target size={18} /></span>
                    <span className="dna-keyword-orbit-dot" />
                  </div>
                </div>
                <div className="dna-keyword-grid">
                  {result.missing_keywords.map((item, i) => (
                    <details className="dna-keyword-node" key={`${item}-${i}`} style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                      <summary>
                        <span className="dna-keyword-index">{String(i + 1).padStart(2, "0")}</span>
                        <span className="dna-keyword-term">{item}</span>
                        <span className="dna-keyword-state">NOT DETECTED</span>
                        <ChevronRight size={14} className="dna-keyword-chevron" />
                      </summary>
                      <div className="dna-keyword-detail">
                        <span>CHECK YOUR EVIDENCE</span>
                        <p>Can you point to a real project, coursework, or experience that demonstrates this term? If yes, add it where it fits truthfully; otherwise, leave it out.</p>
                      </div>
                    </details>
                  ))}
                </div>
                <div className="dna-insight-footnote dna-keyword-footnote"><ShieldCheck size={13} /> These are terms to review, not terms you must add.</div>
              </section>
            )}



            {!!result.improved_bullets?.length && (

              <section id="dna-bullet-lab" className="da-card keyword-card dna-bullet-card">

                <div className="dna-section-heading">

                  <div><div className="eyebrow">Bullet lab</div><h3>Find the stronger signal</h3>

                    <p>Start with a point from your resume. Reveal a possible refinement, inspect the highlighted wording, and decide what deserves to stay.</p>

                  </div>

                  <span className="dna-section-mark"><FileText size={17} /></span>

                </div>

                {result.improved_bullets.map((b, i) => {
                  const originalText = String(b.original || b.before || "").trim();
                  const improvedText = String(b.improved || b.after || "").trim();
                  // STORY_REVEAL_SMART_CLASSIFICATION_V1
                  // Compare normalized word sequences so punctuation/case-only differences
                  // do not masquerade as real improvements (for example, adding/removing a period).
                  const tokenizeBullet = (value) => String(value || "").toLowerCase().match(/[a-z0-9]+(?:[+#./-][a-z0-9]+)*/g) || [];
                  const originalWords = tokenizeBullet(originalText);
                  const improvedWords = tokenizeBullet(improvedText);
                  const originalSet = new Set(originalWords);
                  const improvedSet = new Set(improvedWords);
                  const addedTerms = [...new Set(improvedWords.filter((word) => !originalSet.has(word)))];
                  const removedTerms = [...new Set(originalWords.filter((word) => !improvedSet.has(word)))];
                  const changedTermCount = addedTerms.length + removedTerms.length;
                  const normalizedOriginal = originalWords.join(" ");
                  const normalizedImproved = improvedWords.join(" ");
                  const isAlreadyStrong = normalizedOriginal === normalizedImproved;

                  // Word-level Levenshtein distance estimates how much of the sentence changed.
                  let editRow = Array.from({ length: improvedWords.length + 1 }, (_, index) => index);
                  for (let rowIndex = 1; rowIndex <= originalWords.length; rowIndex += 1) {
                    const nextRow = [rowIndex];
                    for (let colIndex = 1; colIndex <= improvedWords.length; colIndex += 1) {
                      const substitutionCost = originalWords[rowIndex - 1] === improvedWords[colIndex - 1] ? 0 : 1;
                      nextRow[colIndex] = Math.min(
                        nextRow[colIndex - 1] + 1,
                        editRow[colIndex] + 1,
                        editRow[colIndex - 1] + substitutionCost
                      );
                    }
                    editRow = nextRow;
                  }
                  const wordEditDistance = editRow[improvedWords.length];
                  const changeRatio = wordEditDistance / Math.max(originalWords.length, improvedWords.length, 1);
                  // A meaningful label requires several changed terms and a substantial edit.
                  // Reordering alone or a single synonym swap is not advertised as a strong rewrite.
                                    // STORY_REVEAL_CLASSIFICATION_GUARD_V2
                  // A stronger label needs more than a handful of synonym substitutions.
                  // Preserve numeric evidence, acronyms, and multi-word scope indicators.
                  const sourceNumbers = originalText.match(/(?<![a-z])\d+(?:\.\d+)?\s*(?:%|percent)?(?![a-z])/gi) || [];
                  const suggestedLower = improvedText.toLowerCase();
                  const missingSourceNumbers = sourceNumbers.filter((value) => !suggestedLower.includes(value.toLowerCase().replace(/\s+/g, "")));
                  const sourceAcronyms = originalText.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)*\b/g) || [];
                  const missingSourceAcronyms = sourceAcronyms.filter((value) => !suggestedLower.includes(value.toLowerCase()));
                  const scopeTerms = new Set(["across", "multiple", "several", "various", "throughout", "within", "observation", "observations", "window", "windows", "dataset", "datasets", "sample", "samples", "experiment", "experiments", "iteration", "iterations", "fold", "folds", "records", "regions", "locations", "scenarios"]);
                  const missingScopeTerms = [...new Set(originalWords.filter((word) => scopeTerms.has(word) && !improvedWords.includes(word)))];
                  const hasSourceDetailLoss = missingSourceNumbers.length > 0 || missingSourceAcronyms.length > 0 || missingScopeTerms.length >= 2;

                  // Require a large edit ratio; a few verb swaps should remain a light wording change.
                  const meaningfulRewrite = !isAlreadyStrong && !hasSourceDetailLoss && changedTermCount >= 6 && wordEditDistance >= 5 && changeRatio >= 0.30;
                  const statusLabel = isAlreadyStrong
                    ? "Already strong"
                    : hasSourceDetailLoss
                      ? "Review source details"
                      : meaningfulRewrite
                        ? "Restructured rewrite"
                        : "Small wording change";
                  const revealLabel = hasSourceDetailLoss
                    ? "Review source details"
                    : meaningfulRewrite
                      ? "Reveal the restructured version"
                      : "Reveal the wording option";
                  // STORY_REVEAL_ACCURATE_DIFF_V2
                  // LCS highlights added/reordered wording in the suggestion using the same
                  // tokenizer as classification (so compounds like full-stack/INSAT-3D stay intact).
                  const unmatchedImprovedWordIndexes = new Set();
                  const diffTable = Array.from(
                    { length: originalWords.length + 1 },
                    () => Array(improvedWords.length + 1).fill(0)
                  );
                  for (let sourceIndex = originalWords.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
                    for (let suggestedIndex = improvedWords.length - 1; suggestedIndex >= 0; suggestedIndex -= 1) {
                      diffTable[sourceIndex][suggestedIndex] = originalWords[sourceIndex] === improvedWords[suggestedIndex]
                        ? 1 + diffTable[sourceIndex + 1][suggestedIndex + 1]
                        : Math.max(diffTable[sourceIndex + 1][suggestedIndex], diffTable[sourceIndex][suggestedIndex + 1]);
                    }
                  }
                  let sourceCursor = 0;
                  let suggestedCursor = 0;
                  while (sourceCursor < originalWords.length && suggestedCursor < improvedWords.length) {
                    if (originalWords[sourceCursor] === improvedWords[suggestedCursor]) {
                      sourceCursor += 1;
                      suggestedCursor += 1;
                    } else if (diffTable[sourceCursor + 1][suggestedCursor] >= diffTable[sourceCursor][suggestedCursor + 1]) {
                      sourceCursor += 1;
                    } else {
                      unmatchedImprovedWordIndexes.add(suggestedCursor);
                      suggestedCursor += 1;
                    }
                  }
                  while (suggestedCursor < improvedWords.length) {
                    unmatchedImprovedWordIndexes.add(suggestedCursor);
                    suggestedCursor += 1;
                  }

                  // Flag source words only when their occurrence count is not preserved in the suggestion.
                  // This avoids treating simple reordering as lost source detail.
                  const improvedWordFrequency = new Map();
                  improvedWords.forEach((word) => improvedWordFrequency.set(word, (improvedWordFrequency.get(word) || 0) + 1));
                  const seenSourceWordFrequency = new Map();
                  const omittedOriginalWordIndexes = new Set();
                  originalWords.forEach((word, wordIndex) => {
                    const seen = seenSourceWordFrequency.get(word) || 0;
                    if (seen >= (improvedWordFrequency.get(word) || 0)) omittedOriginalWordIndexes.add(wordIndex);
                    seenSourceWordFrequency.set(word, seen + 1);
                  });

                  let renderedWordIndex = 0;
                  const highlightedImprovedText = improvedText.split(/(\s+)/).map((part, partIndex) => {
                    const partTokens = part.toLowerCase().match(/[a-z0-9]+(?:[+#./-][a-z0-9]+)*/g) || [];
                    const containsChangedWord = partTokens.some((_, offset) => unmatchedImprovedWordIndexes.has(renderedWordIndex + offset));
                    renderedWordIndex += partTokens.length;
                    return containsChangedWord
                      ? <mark className="rewrite-changed-word" key={partIndex}>{part}</mark>
                      : <span key={partIndex}>{part}</span>;
                  });
                  let renderedSourceWordIndex = 0;
                  const highlightedOriginalText = originalText
                    ? originalText.split(/(\s+)/).map((part, partIndex) => {
                        const partTokens = part.toLowerCase().match(/[a-z0-9]+(?:[+#./-][a-z0-9]+)*/g) || [];
                        const containsOmittedWord = partTokens.some((_, offset) => omittedOriginalWordIndexes.has(renderedSourceWordIndex + offset));
                        renderedSourceWordIndex += partTokens.length;
                        return containsOmittedWord
                          ? <mark className="rewrite-omitted-word" key={partIndex}>{part}</mark>
                          : <span key={partIndex}>{part}</span>;
                      })
                    : "No source text was returned.";

                  return (
                    <article className={`rewrite-spotlight ${hasSourceDetailLoss ? "is-review" : meaningfulRewrite ? "is-meaningful" : isAlreadyStrong ? "is-strong" : "is-light"}`} key={`${i}-${originalText.slice(0, 24)}`}>
                      <div className="rewrite-spotlight-head">
                        <div className="rewrite-point-id"><span className="rewrite-point-orb"><Sparkles size={14} /></span><span>RESUME SIGNAL <strong>{String(i + 1).padStart(2, "0")}</strong></span></div>
                        <span className={`rewrite-status ${isAlreadyStrong ? "status-strong" : hasSourceDetailLoss ? "status-review" : meaningfulRewrite ? "status-ready" : "status-light"}`}>{statusLabel}</span>
                      </div>

                      <div className="rewrite-source-block">
                        <div className="rewrite-label-row"><span>FOUND IN YOUR RESUME</span><span className="rewrite-source-mark">SOURCE</span></div>
                        <p>{originalText || "No source text was returned."}</p>
                      </div>

                      {isAlreadyStrong ? (
                        <div className="rewrite-already-note">
                          <CheckCircle2 size={16} />
                          <div><strong>This point is already clear.</strong><p>The suggestion adds no meaningful wording change. Keep the original instead of rewriting for the sake of it.</p></div>
                          <button type="button" className="rewrite-copy-button rewrite-copy-muted" onClick={() => navigator.clipboard?.writeText(originalText).then(() => toast.success("Original bullet copied")).catch(() => toast.error("Copy failed; please select the text manually."))}><ClipboardPaste size={14} /> Copy original</button>
                        </div>
                      ) : (
                        <details name="resumeai-story-reveal" className="rewrite-reveal" open={i === result.improved_bullets.findIndex((candidate) => { const source = String(candidate.original || candidate.before || "").toLowerCase().match(/[a-z0-9]+(?:[+#./-][a-z0-9]+)*/g) || []; const proposed = String(candidate.improved || candidate.after || "").toLowerCase().match(/[a-z0-9]+(?:[+#./-][a-z0-9]+)*/g) || []; return source.join(" ") !== proposed.join(" "); })}>
                          <summary>
                            <span className="rewrite-reveal-glyph"><Sparkles size={16} /></span>
                            <span className="rewrite-reveal-summary"><strong>{revealLabel}</strong><small>{hasSourceDetailLoss ? "The suggested version may omit source scope or evidence. Review the flagged source wording first." : meaningfulRewrite ? "The sentence has been reworked. Check that the facts and ownership still match your experience." : "Only a small wording change. Open it to decide whether the edit genuinely helps."}</small></span>
                            <span className="rewrite-reveal-action">REVEAL <ChevronRight size={15} /></span>
                          </summary>
                          <div className="rewrite-reveal-content">
                            <div className="rewrite-output-top"><span className="rewrite-output-label">POSSIBLE REWRITE</span><span className="rewrite-review-badge"><ShieldCheck size={12} /> REVIEW BEFORE USING</span></div>
                            <p className="rewrite-output-text">{highlightedImprovedText}</p>
                            {!!omittedOriginalWordIndexes.size && (
                              <div className="rewrite-omission-check">
                                <div className="rewrite-omission-head"><strong>Source wording to check</strong><span>NOT CARRIED OVER VERBATIM</span></div>
                                <p>{highlightedOriginalText}</p>
                                <small>Highlighted source terms are missing from this version. Check that no important scope, method, or evidence was lost before copying it.</small>
                              </div>
                            )}
                            <div className="rewrite-diff-key"><span className="rewrite-diff-swatch" /> Gold highlights show words added or reworked in the suggestion. Rose highlights show source wording not carried over verbatim. Check both before using the rewrite.</div>
                            <div className="rewrite-review-lenses">
                              <div><span>01 / CLARITY</span><p>Can a recruiter understand the contribution quickly?</p></div>
                              <div><span>02 / OWNERSHIP</span><p>Does the action reflect what you personally did?</p></div>
                              <div><span>03 / EVIDENCE</span><p>Keep tools, scope and metrics only when accurate.</p></div>
                            </div>
                            <div className="rewrite-reveal-footer">
                              <button type="button" className="rewrite-copy-button" onClick={() => navigator.clipboard?.writeText(improvedText).then(() => toast.success("Suggested bullet copied")).catch(() => toast.error("Copy failed; please select the text manually."))}><ClipboardPaste size={14} /> Copy suggested version</button>
                              <span><ShieldCheck size={14} /> You stay in control of the final wording.</span>
                            </div>
                          </div>
                        </details>
                      )}
                    </article>
                  );
                })}

              </section>

            )}

          </div>

        )}

      </div>

    );

  };

  const renderRewrite = () => {
    const isStructuredResume = Boolean(
      rewritten && typeof rewritten === "object" && rewritten.format_version === 1
    );
    const currentRole = jobRole.trim() || "Software Engineer";
    const rewriteRoleChanged = Boolean(
      rewritten && rewrittenJobRole &&
      rewrittenJobRole.trim().replace(/\s+/g, " ").toLowerCase() !==
        currentRole.trim().replace(/\s+/g, " ").toLowerCase()
    );

    return (
      <div className="tab-content-active stack-lg">
        <div className="page-heading">
          <div>
            <div className="eyebrow">Rewrite</div>
            <h2>Make your resume sharper.</h2>
            <p>Build a complete, role-tailored resume with structured sections and a ready-to-download PDF.</p>
          </div>
        </div>
        {renderUploadPanel(true)}
        {renderRoleCard()}
        <div className="action-row">
          <button className="primary-button" onClick={handleRewrite} disabled={rewriteLoading || !hasResume}>
            {rewriteLoading ? <><RefreshCw size={16} className="spin" /> Building your resume...</> : <><Sparkles size={16} /> Build tailored resume</>}
          </button>
          {rewritten && (
            <button className="secondary-button" onClick={downloadPDF} disabled={rewriteRoleChanged || rewriteLoading}>
              <Download size={16} /> Download resume PDF
            </button>
          )}
        </div>
        {rewriteRoleChanged && (
          <div className="bullet-row warning">
            <AlertCircle size={15} />
            <span>The target role changed after this resume was generated. Build the tailored resume again before downloading for the new role.</span>
          </div>
        )}
        {rewritten && (
          <section className="da-card document-card">
            <div className="document-header">
              <div>
                <div className="eyebrow">One-click resume builder</div>
                <h3>{isStructuredResume ? "Resume ready to review" : "Resume draft"}</h3>
                <p>Structured sections, consistent formatting, and role-specific ordering.</p>
              </div>
              <span className="soft-badge">{isStructuredResume ? "Professional PDF ready" : "Legacy text preview"}</span>
            </div>
            {isStructuredResume ? (
              <TailoredResumePreview value={rewritten} targetRole={jobRole.trim() || "Target role"} />
            ) : (
              <pre>{String(rewritten)}</pre>
            )}
            <p
              className="resumeAI-review-note"
              style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, color: "var(--dash-muted, #9ca3af)" }}
            >
              Generated from your source resume. Before sending it to an employer, quickly verify your contact details,
              dates, credentials, and project metrics.
            </p>
          </section>
        )}
      </div>
    );
  };

  /* RESUMEAI_JOB_MATCH_EXPERIENCE_V1 */
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
    const matchScore = Math.max(0, Math.min(100, Number(jdResult?.match_score) || 0));
    const totalRequired = requiredMatched.length + requiredMissing.length;

    const allMatched = [...new Set([...requiredMatched, ...preferredMatched, ...generalMatched])];
    const allMissing = [...new Set([...requiredMissing, ...preferredMissing, ...generalMissing])];
    const scoreTone = matchScore >= 80 ? 'success' : matchScore >= 60 ? 'warm' : 'danger';
    const fitLabel = matchScore >= 80 ? 'Strong overlap' : matchScore >= 60 ? 'Promising overlap' : 'Needs tailoring';
    const fitHeadline = matchScore >= 80
      ? "Your resume speaks this role's language."
      : matchScore >= 60
        ? 'You have a foundation to build on.'
        : 'There are clear gaps to work through.';

    const SkillChips = ({ items, tone }) => (
      <div className={`jm-chip-list ${items.length ? '' : 'is-empty'}`}>
        {items.length ? items.map((skill, index) => (
          <span className={`jm-skill-chip jm-skill-chip-${tone}`} key={`${skill}-${index}`}>
            <span className="jm-chip-dot" />{skill}
          </span>
        )) : <span className="jm-empty-note">No signals detected in this category</span>}
      </div>
    );

    const ScoreMeter = ({ label, caption, score, max, icon }) => {
      const hasData = Number(max) > 0;
      const percentage = hasData ? Math.max(0, Math.min(100, Math.round((Number(score) / Number(max)) * 100))) : 0;
      return (
        <div className="jm-score-meter">
          <div className="jm-meter-head">
            <span className="jm-meter-symbol">{icon}</span>
            <div className="jm-meter-title"><strong>{label}</strong><small>{caption}</small></div>
            <span className="jm-meter-value">{hasData ? `${score}/${max}` : '—'}</span>
          </div>
          <div className="jm-meter-track" role="img" aria-label={`${label}: ${hasData ? `${percentage}%` : 'not detected'}`}>
            <span className={hasData ? '' : 'is-empty'} style={{ width: `${percentage}%` }} />
          </div>
          <div className="jm-meter-foot">{hasData ? `${percentage}% of available category points` : 'No category score available'}</div>
        </div>
      );
    };

    const SkillGroup = ({ title, kicker, matched, missing, note, tone }) => {
      const total = matched.length + missing.length;
      const coverage = total ? Math.round((matched.length / total) * 100) : 0;
      return (
        <article className={`jm-skill-group jm-skill-group-${tone}`}>
          <div className="jm-group-top">
            <div><span className="jm-group-kicker">{kicker}</span><h4>{title}</h4></div>
            <div className="jm-group-fraction"><strong>{total ? `${matched.length}/${total}` : '—'}</strong><span>matched</span></div>
          </div>
          <div className="jm-group-track" role="img" aria-label={`${title} coverage: ${total ? `${coverage}%` : 'not detected'}`}>
            <span style={{ width: `${coverage}%` }} />
          </div>
          <p className="jm-group-note">{note}</p>
          <div className="jm-signal-block">
            <div className="jm-signal-label jm-signal-label-match"><CheckCircle2 size={14} /> In your resume <span>{matched.length}</span></div>
            <SkillChips items={matched} tone="match" />
          </div>
          <div className="jm-signal-block jm-signal-block-missing">
            <div className="jm-signal-label jm-signal-label-gap"><AlertCircle size={14} /> Missing or underrepresented <span>{missing.length}</span></div>
            <SkillChips items={missing} tone="gap" />
          </div>
        </article>
      );
    };

    const copyMissingSignals = async () => {
      if (!allMissing.length) {
        toast.error('No missing skill signals to copy');
        return;
      }
      try {
        await navigator.clipboard.writeText(allMissing.join(', '));
        toast.success('Missing skill signals copied');
      } catch {
        toast.error('Could not copy automatically. Select the keywords and copy them manually.');
      }
    };

    return (
      <div className="tab-content-active stack-lg jm-workspace">
        <div className="page-heading jm-page-heading">
          <div>
            <div className="eyebrow">Opportunity intelligence / 02</div>
            <h2>Find your strongest fit.</h2>
            <p>See what already aligns, what the role still asks for, and where your next improvement will matter most.</p>
          </div>
          <div className="jm-flow-rail" aria-label="Job match workflow">
            <span className="is-current"><b>01</b> Compare</span>
            <span><b>02</b> Explore gaps</span>
            <span><b>03</b> Take action</span>
          </div>
        </div>

        {renderUploadPanel(true)}

        <section className="da-card jm-input-card">
          <div className="jm-input-head">
            <div className="jm-input-title-wrap">
              <span className="jm-input-icon"><ClipboardPaste size={18} /></span>
              <div>
                <div className="eyebrow">Role brief</div>
                <h3>Bring the job description into focus.</h3>
                <p>Paste the full posting so ResumeAI can compare its requirements against the evidence in your resume.</p>
              </div>
            </div>
            <span className="jm-input-limit">Up to 30,000 characters</span>
          </div>
          <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} className="da-textarea jm-job-textarea" placeholder="Paste the job description here — responsibilities, required skills, preferred skills, and qualifications…" aria-label="Job description" />
          <div className="jm-input-footer">
            <span className={`jm-char-count ${jdText.length > 30000 ? 'is-over-limit' : ''}`}>{jdText.length.toLocaleString()} <span>/ 30,000 characters</span></span>
            <span className="jm-input-privacy"><ShieldCheck size={14} /> Match score uses detected resume and job-description evidence.</span>
            <button className="primary-button jm-match-button" onClick={handleJDMatch} disabled={jdLoading || !hasResume || !jdText.trim()}>
              {jdLoading ? <><RefreshCw size={16} className="spin" /> Reading requirements...</> : <><Target size={16} /> Reveal job fit <ArrowRight size={15} /></>}
            </button>
          </div>
        </section>

        {!jdResult && (
          <section className="jm-preview-board" aria-label="What the job match report includes">
            <div className="jm-preview-heading"><div><div className="eyebrow">What you'll discover</div><h3>Not just a percentage. A plan.</h3></div><span className="jm-preview-lockup"><Sparkles size={16} /> Match intelligence</span></div>
            <div className="jm-preview-grid">
              <article className="jm-preview-item"><span className="jm-preview-number">01</span><div className="jm-preview-glyph"><Target size={17} /></div><h4>Where you align</h4><p>See the required and preferred skills already evidenced in your resume.</p></article>
              <article className="jm-preview-item"><span className="jm-preview-number">02</span><div className="jm-preview-glyph"><Target size={17} /></div><h4>What needs attention</h4><p>Separate missing signals from requirements that are already supported.</p></article>
              <article className="jm-preview-item"><span className="jm-preview-number">03</span><div className="jm-preview-glyph"><ArrowRight size={17} /></div><h4>What to do next</h4><p>Turn the match report into focused, evidence-led resume improvements.</p></article>
            </div>
          </section>
        )}

        {jdResult && (
          <div className="jm-result-stack">
            <section className="da-card jm-hero-card">
              <div className="jm-hero-orbit jm-hero-orbit-one" /><div className="jm-hero-orbit jm-hero-orbit-two" />
              <div className="jm-report-kicker"><span><Sparkles size={14} /> ROLE FIT REPORT</span><span className="jm-report-transparency"><ShieldCheck size={13} /> Deterministic score Â· transparent categories</span></div>
              <div className="jm-hero-main">
                <div className="jm-hero-copy">
                  <div className="eyebrow">Your job match estimate</div>
                  <h3>{fitHeadline}</h3>
                  <p>{jdResult.recommendation || 'Use the match breakdown to focus your next resume edit on evidence you can genuinely support.'}</p>
                  <div className="jm-hero-badges"><span className={`jm-fit-badge jm-fit-${scoreTone}`}>{fitLabel}</span><span className="jm-evidence-badge"><CheckCircle2 size={13} /> Resume evidence first</span></div>
                </div>
                <div className="jm-score-display">
                  <div className={`score-ring jm-score-ring ${scoreTone}`} style={{ '--score': `${matchScore}%` }}>
                    <div className="score-ring-inner jm-score-ring-inner"><strong>{matchScore}</strong><span>/100</span></div>
                  </div>
                  <div className="jm-score-caption"><strong>Match score</strong><span>Compatibility estimate</span></div>
                </div>
              </div>
              <div className="jm-quick-stats">
                <div className="jm-quick-stat"><span className="jm-stat-mark jm-stat-mark-match"><CheckCircle2 size={14} /></span><div><strong>{allMatched.length}</strong><span>Matched skill signals</span></div></div>
                <div className="jm-quick-stat"><span className="jm-stat-mark jm-stat-mark-gap"><AlertCircle size={14} /></span><div><strong>{allMissing.length}</strong><span>Gaps to review</span></div></div>
                <div className="jm-quick-stat"><span className="jm-stat-mark jm-stat-mark-required"><Target size={14} /></span><div><strong>{totalRequired ? `${requiredMatched.length}/${totalRequired}` : '—'}</strong><span>Required skills matched</span></div></div>
              </div>
            </section>

            <section className="da-card jm-breakdown-card">
              <div className="jm-section-heading"><div><div className="eyebrow">Score anatomy</div><h3>What is shaping your match?</h3><p>Each bar uses the category score supplied by the matching engine.</p></div><span className="jm-heading-icon"><BarChart3 size={17} /></span></div>
              <div className="jm-score-meters">
                <ScoreMeter label="Required skills" caption="Core requirements" score={requiredScore.score} max={requiredScore.max} icon={<Target size={15} />} />
                <ScoreMeter label="Preferred skills" caption="Additional advantage" score={preferredScore.score} max={preferredScore.max} icon={<Sparkles size={15} />} />
                <ScoreMeter label="General alignment" caption="Broader role signals" score={generalScore.score} max={generalScore.max} icon={<ArrowRight size={15} />} />
              </div>
              <p className="jm-score-note"><ShieldCheck size={14} /> Categories with no detected skills are reported as unavailable rather than treated as evidence.</p>
            </section>

            <section className="da-card jm-explorer-card">
              <div className="jm-section-heading jm-explorer-heading"><div><div className="eyebrow">Skill signal explorer</div><h3>What's present—and what's still missing.</h3><p>Skills are grouped by their role in the job description. A missing keyword is a prompt to review your evidence, not a claim that you have the skill.</p></div><div className="jm-explorer-legend"><span><i className="is-match" />Matched</span><span><i className="is-gap" />Gap to review</span></div></div>
              <div className={`jm-skill-groups ${(generalMatched.length || generalMissing.length) ? "" : "jm-skill-groups-two"}`}>
                <SkillGroup title="Required skills" kicker="Must-have" matched={requiredMatched} missing={requiredMissing} note="Start here: these requirements typically matter most to role fit." tone="required" />
                <SkillGroup title="Preferred skills" kicker="Nice-to-have" matched={preferredMatched} missing={preferredMissing} note="Helpful differentiators that may strengthen your application." tone="preferred" />
                {(generalMatched.length || generalMissing.length) ? <SkillGroup title="General alignment" kicker="Context" matched={generalMatched} missing={generalMissing} note="Broader language and signals found in the role description." tone="general" /> : null}
              </div>
              <div className="jm-explorer-footer"><span>{allMissing.length ? `${allMissing.length} unique missing signals to review` : 'No missing signals detected in the returned categories'}</span><button className="secondary-button small" onClick={copyMissingSignals} disabled={!allMissing.length}><ClipboardPaste size={14} /> Copy gaps</button></div>
            </section>

            <section className="da-card jm-action-card">
              <div className="jm-action-emblem"><ArrowRight size={19} /></div>
              <div className="jm-action-copy"><div className="eyebrow">Your next move</div><h3>Turn the findings into an evidence-led edit.</h3><p>{jdResult.recommendation || 'Prioritize the most important gaps, then tailor your resume only with skills and achievements you can substantiate.'}</p><span className="jm-action-footnote"><ShieldCheck size={13} /> Never add a skill, project, or metric unless it reflects your real experience.</span></div>
              <button className="primary-button jm-action-button" onClick={() => goTo('rewrite')}><PenLine size={16} /> Improve my resume <ArrowRight size={15} /></button>
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

  // Database datetimes are stored as UTC; SQLite responses may omit the trailing Z.
  // Interpret timezone-less server timestamps as UTC, then format them in the browser's local timezone.
  const parseServerDateTime = (value) => {
    if (!value) return null;
    const timestamp = String(value).trim();
    if (!timestamp) return null;
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
    const parsed = new Date(hasTimezone ? timestamp : `${timestamp}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatTrackingDate = (value, includeTime = false) => {
    if (!value) return "Not set";

    const date = parseServerDateTime(value);
    if (!date) return "Not set";

    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(date);
  };

  const getDeadlineState = (value) => {
    if (!value) return { label: "No deadline", tone: "neutral" };

    const deadline = parseServerDateTime(value);
    if (!deadline) {
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

    const followUp = parseServerDateTime(value);
    if (!followUp) {
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

  /* RESUMEAI_TRACKER_DATE_TIME_INPUTS_V1 */
  // Convert server timestamps to the user's local wall-clock values before editing.
  const toLocalDateTimeInput = (value) => {
    if (!value) return "";
    const parsed = parseServerDateTime(value);
    if (!parsed) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  };

  const splitTrackingDateTime = (value, part) => {
    const [date = "", time = ""] = String(value || "").split("T");
    if (part === "date") return date;
    // A time without a date is not a meaningful deadline/follow-up value.
    return date ? time : "";
  };

  const updateTrackingDateTimePart = (field, part, value) => {
    setTrackingForm((previous) => {
      const [currentDate = "", currentTime = ""] = String(previous[field] || "").split("T");
      if (part === "date") {
        if (!value) return { ...previous, [field]: "" };
        // Preserve a time only when editing an existing date; a newly selected date starts at 9 AM.
        const nextTime = currentDate ? (currentTime || "09:00") : "09:00";
        return { ...previous, [field]: `${value}T${nextTime}` };
      }
      if (!currentDate) return { ...previous, [field]: "" };
      return { ...previous, [field]: `${currentDate}T${value || "09:00"}` };
    });
  };

  const toUtcIsoFromTrackingInput = (value) => {
    const [date = "", time = ""] = String(value || "").split("T");
    if (!date) return null;
    const parsed = new Date(`${date}T${time || "09:00"}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const syncTrackingForm = (opportunity) => {
    if (!opportunity) return;

    setTrackingForm({
      application_deadline: toLocalDateTimeInput(opportunity.application_deadline),
      follow_up_at: toLocalDateTimeInput(opportunity.follow_up_at),
      notes: opportunity.notes || "",
      source_url: opportunity.source_url || "",
    });
  };

  const saveOpportunityMetadata = async () => {
    if (!selectedOpportunity?.id) return;

    setOpportunityActionLoading(true);

    try {
      const payload = {
        application_deadline: toUtcIsoFromTrackingInput(trackingForm.application_deadline),
        follow_up_at: toUtcIsoFromTrackingInput(trackingForm.follow_up_at),
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

    const query = opportunitySearch.trim().toLowerCase();
    const filteredOpportunities = opportunities.filter((item) => {
      const haystack = [item.company_name, item.job_title, item.status, item.job_description]
        .filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = opportunityStatusFilter === "all" || item.status === opportunityStatusFilter;
      return matchesQuery && matchesStatus;
    });
    const submittedCount = opportunities.filter((item) => ["applied", "interview", "offer"].includes(item.status)).length;
    const interviewCount = opportunities.filter((item) => item.status === "interview").length;
    const offerCount = opportunities.filter((item) => item.status === "offer").length;

    const openSelectedOpportunity = (id) => {
      setOpportunityDetailTab("overview");
      openOpportunity(id);
    };

    const renderOpportunityCard = (item) => (
      <button
        type="button"
        key={item.id}
        className={`tracker-app-row ${selectedOpportunity?.id === item.id ? "selected" : ""}`}
        onClick={() => openSelectedOpportunity(item.id)}
      >
        <span className="tracker-app-monogram">{(item.company_name || "C").charAt(0).toUpperCase()}</span>
        <span className="tracker-app-row-main">
          <strong>{item.job_title}</strong>
          <span>{item.company_name}</span>
          <span className="tracker-app-row-meta">
            <span className={`status-pill status-${item.status}`}>{statusLabels[item.status] || item.status}</span>
            {item.match_score != null && <span className={`tracker-inline-score ${getScoreTone(item.match_score)}`}>{item.match_score}% match</span>}
            {item.application_deadline && <span className={`tracker-inline-deadline ${getDeadlineState(item.application_deadline).tone}`}>{getDeadlineState(item.application_deadline).label}</span>}
          </span>
        </span>
        <span className="tracker-app-row-date">{item.updated_at || item.created_at ? new Date(item.updated_at || item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "New"}</span>
        <ChevronRight size={15} className="muted-icon" />
      </button>
    );

    const renderBoard = () => (
      <div className="tracker-board-scroll">
        <div className="tracker-board-grid">
          {OPPORTUNITY_STAGES.map((stage) => {
            const items = filteredOpportunities.filter((item) => item.status === stage.id);
            return (
              <section
                key={stage.id}
                className="tracker-board-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleKanbanDrop(event, stage.id)}
              >
                <header className="tracker-board-column-head">
                  <div><strong>{stage.label}</strong><small>{stage.hint}</small></div>
                  <span>{items.length}</span>
                </header>
                <div className="tracker-board-column-body">
                  {items.length ? items.map((item) => (
                    <div
                      key={item.id}
                      className={`tracker-board-item ${selectedOpportunity?.id === item.id ? "selected" : ""}`}
                      draggable
                      role="button"
                      tabIndex={0}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", String(item.id));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => openSelectedOpportunity(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openSelectedOpportunity(item.id);
                        }
                      }}
                    >
                      <div className="tracker-board-item-top"><span>{(item.company_name || "C").charAt(0).toUpperCase()}</span>{item.match_score != null && <small>{item.match_score}%</small>}</div>
                      <strong>{item.job_title}</strong>
                      <small>{item.company_name}</small>
                      {item.application_deadline && <span className={`tracker-inline-deadline ${getDeadlineState(item.application_deadline).tone}`}>{getDeadlineState(item.application_deadline).label}</span>}
                    </div>
                  )) : <div className="tracker-board-empty">No matching roles</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );

    const renderSelectedDetails = () => {
      if (!selectedOpportunity) {
        return (
          <div className="tracker-detail-empty">
            <div className="tracker-detail-empty-icon"><BriefcaseBusiness size={22} /></div>
            <div className="eyebrow">Application workspace</div>
            <h3>Select an application</h3>
            <p>Choose a role from the list to review its progress, update dates, and continue preparing your application.</p>
            {opportunities.length > 0 && <button className="secondary-button small" onClick={() => openSelectedOpportunity(filteredOpportunities[0]?.id || opportunities[0].id)}>Open an application <ArrowRight size={14} /></button>}
          </div>
        );
      }

      const readiness = getOpportunityReadiness(selectedOpportunity);
      const steps = [
        { key: "match", label: "Job match", done: readiness.steps.match, action: () => runOpportunityAction("match"), button: "Run match" },
        { key: "tailored", label: "Rewrite resume", done: readiness.steps.tailored, action: () => runOpportunityAction("tailor"), button: "Tailor resume" },
        { key: "cover", label: "Cover letter", done: readiness.steps.cover, action: () => runOpportunityAction("cover-letter"), button: "Create letter" },
        { key: "interview", label: "Application pack", done: readiness.steps.interview, action: prepareApplication, button: "Prepare pack" },
        { key: "applied", label: "Application submitted", done: readiness.steps.applied, action: () => updateOpportunityStatus("applied"), button: "Mark applied" },
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
        <>
          <div className="tracker-detail-header">
            <div className="tracker-detail-title-wrap">
              <span className="tracker-detail-monogram">{(selectedOpportunity.company_name || "C").charAt(0).toUpperCase()}</span>
              <div><div className="eyebrow">{selectedOpportunity.company_name}</div><h3>{selectedOpportunity.job_title}</h3><p>Created {selectedOpportunity.created_at ? new Date(selectedOpportunity.created_at).toLocaleDateString() : "recently"}</p></div>
            </div>
            <div className="tracker-detail-header-actions">
              <select aria-label="Application status" value={selectedOpportunity.status} onChange={(event) => updateOpportunityStatus(event.target.value)} disabled={opportunityActionLoading} className="status-select">
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" className="icon-button danger-icon-button" onClick={deleteOpportunity} aria-label="Delete opportunity" title="Delete opportunity"><Trash2 size={16} /></button>
            </div>
          </div>

          <div className="tracker-detail-tabs" role="tablist" aria-label="Application details">
            {[ ["overview", "Overview"], ["details", "Details"], ["activity", "Activity"], ["assets", "AI assets"] ].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={opportunityDetailTab === id} className={opportunityDetailTab === id ? "active" : ""} onClick={() => setOpportunityDetailTab(id)}>{label}</button>
            ))}
          </div>

          {opportunityDetailTab === "overview" && (
            <div className="tracker-detail-tab-body">
              <section className="tracker-readiness-card">
                <div className="tracker-readiness-head"><div><div className="eyebrow">Application readiness</div><h4>{readiness.next}</h4><p>{readiness.completed} of {readiness.total} workflow steps completed</p></div><strong>{readiness.percent}%</strong></div>
                <div className="tracker-progress"><span style={{ width: `${readiness.percent}%` }} /></div>
                <button type="button" className="primary-button small" onClick={continueAction} disabled={opportunityActionLoading || applicationPackLoading || readiness.steps.applied}><ArrowRight size={14} /> Continue next step</button>
              </section>

              <div className="tracker-detail-metrics">
                <div><span>Match score</span><strong>{selectedOpportunity.match_score != null ? `${selectedOpportunity.match_score}%` : "â€”"}</strong></div>
                <div><span>Deadline</span><strong>{selectedOpportunity.application_deadline ? formatTrackingDate(selectedOpportunity.application_deadline) : "Not set"}</strong></div>
                <div><span>Next follow-up</span><strong>{selectedOpportunity.follow_up_at ? formatTrackingDate(selectedOpportunity.follow_up_at) : "Not set"}</strong></div>
              </div>

              <div className="tracker-quick-actions">
                <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("match")} disabled={opportunityActionLoading}><Target size={14} /> Match</button>
                <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("tailor")} disabled={opportunityActionLoading}><PenLine size={14} /> Rewrite resume</button>
                <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("cover-letter")} disabled={opportunityActionLoading}><FileText size={14} /> Cover letter</button>
                <button type="button" className="primary-button small" onClick={prepareApplication} disabled={opportunityActionLoading || applicationPackLoading}>{applicationPackLoading ? <><RefreshCw size={14} className="spin" /> Preparing...</> : <><Sparkles size={14} /> Prepare pack</>}</button>
              </div>

              <div className="tracker-workflow-steps">
                {steps.map((step, index) => (
                  <div className={`tracker-workflow-step ${step.done ? "done" : ""}`} key={step.key}>
                    <span className="tracker-workflow-number">{step.done ? <CheckCircle2 size={14} /> : String(index + 1).padStart(2, "0")}</span>
                    <span className="tracker-workflow-label">{step.label}</span>
                    <span className="tracker-workflow-state">{step.done ? "Done" : "Pending"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {opportunityDetailTab === "details" && (
            <div className="tracker-detail-tab-body">
              <section className="tracker-metadata-card">
                <div className="tracker-section-heading"><div><div className="eyebrow">Application details</div><h4>Dates, source and notes</h4></div><span className="tracking-status-badge">{selectedOpportunity.applied_at ? `Applied ${formatTrackingDate(selectedOpportunity.applied_at)}` : "Not applied yet"}</span></div>
                <div className="tracker-metadata-grid">
                  <div className="tracker-field tracker-datetime-field" role="group" aria-labelledby="tracker-deadline-label">
                    <span id="tracker-deadline-label">Application deadline</span>
                    <div className="tracker-datetime-inputs">
                      <label className="tracker-date-control"><span>Date</span><input type="date" aria-label="Application deadline date" value={splitTrackingDateTime(trackingForm.application_deadline, "date")} onChange={(event) => updateTrackingDateTimePart("application_deadline", "date", event.target.value)} /></label>
                      <label className="tracker-date-control"><span>Time</span><input type="time" aria-label="Application deadline time" disabled={!splitTrackingDateTime(trackingForm.application_deadline, "date")} value={splitTrackingDateTime(trackingForm.application_deadline, "time")} onChange={(event) => updateTrackingDateTimePart("application_deadline", "time", event.target.value)} /></label>
                    </div>
                    <small>{selectedOpportunity.application_deadline ? `Saved: ${formatTrackingDate(selectedOpportunity.application_deadline, true)}` : "Choose a date; time defaults to 9:00 AM."}</small>
                  </div>
                  <div className="tracker-field tracker-datetime-field" role="group" aria-labelledby="tracker-followup-label">
                    <span id="tracker-followup-label">Next follow-up</span>
                    <div className="tracker-datetime-inputs">
                      <label className="tracker-date-control"><span>Date</span><input type="date" aria-label="Next follow-up date" value={splitTrackingDateTime(trackingForm.follow_up_at, "date")} onChange={(event) => updateTrackingDateTimePart("follow_up_at", "date", event.target.value)} /></label>
                      <label className="tracker-date-control"><span>Time</span><input type="time" aria-label="Next follow-up time" disabled={!splitTrackingDateTime(trackingForm.follow_up_at, "date")} value={splitTrackingDateTime(trackingForm.follow_up_at, "time")} onChange={(event) => updateTrackingDateTimePart("follow_up_at", "time", event.target.value)} /></label>
                    </div>
                    <small>{selectedOpportunity.follow_up_at ? `Saved: ${formatTrackingDate(selectedOpportunity.follow_up_at, true)}` : "Choose a date; time defaults to 9:00 AM."}</small>
                  </div>
                  <label className="tracker-field"><span>Application source</span><input type="url" value={trackingForm.source_url} onChange={(event) => setTrackingForm((prev) => ({ ...prev, source_url: event.target.value }))} placeholder="https://job-posting.example" /><small>Original posting or application link</small></label>
                  <label className="tracker-field tracker-notes-field"><span>Private notes <small>{trackingForm.notes.length}/10,000</small></span><textarea value={trackingForm.notes} onChange={(event) => setTrackingForm((prev) => ({ ...prev, notes: event.target.value }))} maxLength={10000} placeholder="Referral, recruiter, follow-up context..." /></label>
                </div>
                <div className="tracker-metadata-footer"><div><span className={`tracking-status-badge ${getDeadlineState(selectedOpportunity.application_deadline).tone}`}>{getDeadlineState(selectedOpportunity.application_deadline).label}</span><span className={`tracking-status-badge ${getFollowUpState(selectedOpportunity.follow_up_at).tone}`}>{getFollowUpState(selectedOpportunity.follow_up_at).label}</span></div><button type="button" className="primary-button small" onClick={saveOpportunityMetadata} disabled={opportunityActionLoading}>{opportunityActionLoading ? <><RefreshCw size={14} className="spin" /> Saving...</> : <><CheckCircle2 size={14} /> Save details</>}</button></div>
              </section>
              <section className="tracker-description-card"><div className="tracker-section-heading"><div><div className="eyebrow">Role brief</div><h4>Job description</h4></div>{selectedOpportunity.source_url && /^https?:\/\//i.test(selectedOpportunity.source_url) && <a href={selectedOpportunity.source_url} target="_blank" rel="noreferrer" className="tracker-source-link">Open source <ArrowRight size={13} /></a>}</div><div className="tracker-jd-preview">{selectedOpportunity.job_description || "No job description saved."}</div></section>
            </div>
          )}

          {opportunityDetailTab === "activity" && (
            <div className="tracker-detail-tab-body">
              <section className="tracker-activity-card"><div className="tracker-section-heading"><div><div className="eyebrow">Application timeline</div><h4>Recent activity</h4></div><span className="soft-badge">{activityData.length} events</span></div>
                {activityLoading ? <div className="tracker-empty-inline"><RefreshCw size={16} className="spin" /> Loading activity...</div> : !activityData.length ? <div className="tracker-empty-inline"><Clock3 size={16} /> No timeline events yet.</div> : <div className="timeline-list tracker-timeline-list">{activityData.map((activity, index) => <div className="timeline-item" key={activity.id}><div className="timeline-marker-wrap"><div className={`timeline-marker timeline-${activity.event_type}`}>{getActivityIcon(activity.event_type)}</div>{index < activityData.length - 1 && <div className="timeline-line" />}</div><div className="timeline-item-content"><div className="timeline-item-topline"><strong>{activity.title}</strong><span>{formatTrackingDate(activity.created_at, true)}</span></div>{activity.details && <p>{activity.details}</p>}</div></div>)}</div>}
              </section>
            </div>
          )}

          {opportunityDetailTab === "assets" && (
            <div className="tracker-detail-tab-body tracker-assets-tab">
              <div className="tracker-assets-actions">
                <span>Generate or refresh role-specific assets</span>
                <div className="tracker-quick-actions">
                  <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("match")} disabled={opportunityActionLoading}><Target size={14} /> Match</button>
                  <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("tailor")} disabled={opportunityActionLoading}><PenLine size={14} /> Rewrite</button>
                  <button type="button" className="secondary-button small" onClick={() => runOpportunityAction("cover-letter")} disabled={opportunityActionLoading}><FileText size={14} /> Cover letter</button>
                  <button type="button" className="primary-button small" onClick={prepareApplication} disabled={opportunityActionLoading || applicationPackLoading}>{applicationPackLoading ? <><RefreshCw size={14} className="spin" /> Preparing...</> : <><Sparkles size={14} /> Prepare pack</>}</button>
                </div>
              </div>

              <div className="tracker-assets-note">
                <Sparkles size={14} />
                <span>Generated content stays collapsed until you open the asset you need.</span>
              </div>

              {selectedOpportunity.match_result && (
                <details className="tracker-asset-disclosure">
                  <summary>
                    <span className="tracker-asset-disclosure-icon"><Target size={16} /></span>
                    <span className="tracker-asset-disclosure-title"><strong>Job match</strong><small>Matched skills, gaps and recommendations</small></span>
                    <span className="tracker-asset-disclosure-value">{selectedOpportunity.match_score != null ? `${selectedOpportunity.match_score}% match` : "Report ready"}</span>
                    <ChevronRight size={16} className="tracker-disclosure-chevron" />
                  </summary>
                  <div className="tracker-asset-disclosure-body">
                    <div className="tracker-section-heading"><div><div className="eyebrow">Requirement intelligence</div><h4>Role requirement signals</h4></div><strong className="tracker-asset-score">{selectedOpportunity.match_score ?? "â€”"}{selectedOpportunity.match_score != null ? "%" : ""}</strong></div>
                    <div className="opp-result-grid">
                      <div><span className="opp-label success-text">Matched</span><div className="chip-wrap">{(selectedOpportunity.match_result.matched_keywords || selectedOpportunity.match_result.matched_required || []).map((keyword, index) => <span className="chip success" key={`${keyword}-${index}`}>{keyword}</span>)}</div></div>
                      <div><span className="opp-label danger-text">Missing / weak</span><div className="chip-wrap">{(selectedOpportunity.match_result.missing_keywords || selectedOpportunity.match_result.missing_required || []).map((keyword, index) => <span className="chip danger" key={`${keyword}-${index}`}>{keyword}</span>)}</div></div>
                    </div>
                    {selectedOpportunity.match_result.recommendation && <div className="recommendation"><Sparkles size={15} /><span>{selectedOpportunity.match_result.recommendation}</span></div>}
                  </div>
                </details>
              )}

              {selectedOpportunity.application_pack && (
                <details className="tracker-asset-disclosure">
                  <summary>
                    <span className="tracker-asset-disclosure-icon"><Sparkles size={16} /></span>
                    <span className="tracker-asset-disclosure-title"><strong>Application pack</strong><small>Preparation checklist and interview materials</small></span>
                    <span className="tracker-asset-disclosure-value">{selectedOpportunity.application_pack.interview_prep?.questions?.length || 0} questions</span>
                    <ChevronRight size={16} className="tracker-disclosure-chevron" />
                  </summary>
                  <div className="tracker-asset-disclosure-body">
                    <div className="tracker-section-heading"><div><div className="eyebrow">Application pack</div><h4>Ready-to-use preparation pack</h4></div><button type="button" className="secondary-button small" onClick={downloadApplicationPack}><Download size={14} /> Download PDF</button></div>
                    <div className="pack-checklist">
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Job match</strong><small>{selectedOpportunity.match_score ?? "â€”"}{selectedOpportunity.match_score != null ? "%" : ""} saved</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Tailored resume</strong><small>{selectedOpportunity.tailored_resume ? "Ready" : "Not generated"}</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Cover letter</strong><small>{selectedOpportunity.cover_letter ? "Ready" : "Not generated"}</small></span></div>
                      <div className="pack-check"><CheckCircle2 size={16} /><span><strong>Interview prep</strong><small>{selectedOpportunity.application_pack.interview_prep?.questions?.length || 0} questions</small></span></div>
                    </div>
                    {!!selectedOpportunity.application_pack.interview_prep?.questions?.length && (
                      <details className="tracker-asset-nested-disclosure">
                        <summary><span>Interview questions</span><span>{selectedOpportunity.application_pack.interview_prep.questions.length}</span><ChevronRight size={14} className="tracker-disclosure-chevron" /></summary>
                        <div className="pack-questions">{selectedOpportunity.application_pack.interview_prep.questions.slice(0, 8).map((question, index) => <div className="pack-question" key={`${question}-${index}`}><span>{index + 1}</span><p>{question}</p></div>)}</div>
                      </details>
                    )}
                    {!!selectedOpportunity.application_pack.interview_prep?.talking_points?.length && (
                      <details className="tracker-asset-nested-disclosure">
                        <summary><span>Talking points</span><span>{selectedOpportunity.application_pack.interview_prep.talking_points.length}</span><ChevronRight size={14} className="tracker-disclosure-chevron" /></summary>
                        <div className="pack-talking-points">{selectedOpportunity.application_pack.interview_prep.talking_points.map((point, index) => <div className="bullet-row" key={`${point}-${index}`}><CheckCircle2 size={15} /><span>{point}</span></div>)}</div>
                      </details>
                    )}
                  </div>
                </details>
              )}

              {selectedOpportunity.tailored_resume && (
                <details className="tracker-asset-disclosure">
                  <summary>
                    <span className="tracker-asset-disclosure-icon"><PenLine size={16} /></span>
                    <span className="tracker-asset-disclosure-title"><strong>Tailored resume</strong><small>Role-specific resume draft</small></span>
                    <span className="tracker-asset-disclosure-value">PDF ready</span>
                    <ChevronRight size={16} className="tracker-disclosure-chevron" />
                  </summary>
                  <div className="tracker-asset-disclosure-body">
                    <div className="tracker-section-heading"><div><div className="eyebrow">Tailored asset</div><h4>Resume draft</h4></div><button type="button" className="secondary-button small" onClick={() => downloadTailoredResumePdf(selectedOpportunity.tailored_resume, selectedOpportunity.job_title)}><Download size={14} /> Download PDF</button></div>
                    <div className="tracker-asset-preview-frame"><TailoredResumePreview value={selectedOpportunity.tailored_resume} targetRole={selectedOpportunity.job_title} /></div>
                  </div>
                </details>
              )}

              {selectedOpportunity.cover_letter && (
                <details className="tracker-asset-disclosure">
                  <summary>
                    <span className="tracker-asset-disclosure-icon"><FileText size={16} /></span>
                    <span className="tracker-asset-disclosure-title"><strong>Cover letter</strong><small>Personalized letter for this role</small></span>
                    <span className="tracker-asset-disclosure-value">Saved</span>
                    <ChevronRight size={16} className="tracker-disclosure-chevron" />
                  </summary>
                  <div className="tracker-asset-disclosure-body">
                    <CoverLetterPreview letter={selectedOpportunity.cover_letter} companyName={selectedOpportunity.company_name} jobTitle={selectedOpportunity.job_title} loading={opportunityActionLoading} onCopy={() => { navigator.clipboard.writeText(selectedOpportunity.cover_letter); toast.success("Cover letter copied"); }} onRegenerate={() => runOpportunityAction("cover-letter")} />
                  </div>
                </details>
              )}

              {!selectedOpportunity.application_pack && !selectedOpportunity.match_result && !selectedOpportunity.tailored_resume && !selectedOpportunity.cover_letter && <div className="tracker-empty-inline"><Sparkles size={16} /> Your generated match report, tailored resume, and cover letter will appear here after you run the tools.</div>}
            </div>
          )}
        </>
      );
    };

    return (
      <div className="tab-content-active tracker-redesign">
        <header className="tracker-redesign-header">
          <div><div className="eyebrow">Career pipeline</div><h2>Applications, organized.</h2><p>Track every role, focus on the next move, and keep job-specific work connected.</p></div>
          <div className="tracker-header-actions">
            <button type="button" className="secondary-button small" onClick={() => { fetchOpportunities(); fetchOpportunityAnalytics(); }} disabled={opportunityLoading || analyticsLoading}><RefreshCw size={14} className={(opportunityLoading || analyticsLoading) ? "spin" : ""} /> Refresh</button>
            <button type="button" className="primary-button" onClick={() => setShowOpportunityForm((value) => !value)}><BriefcaseBusiness size={15} /> {showOpportunityForm ? "Close form" : "New opportunity"}</button>
          </div>
        </header>

        {showOpportunityForm && <section className="da-card tracker-create-card"><div className="tracker-section-heading"><div><div className="eyebrow">New application</div><h4>Add a role to your pipeline</h4></div><span className="tracker-form-hint">Company, role and job description required</span></div><div className="tracker-create-grid"><input aria-label="Company name" className="da-input" value={opportunityForm.company_name} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, company_name: event.target.value }))} placeholder="Company name" /><input aria-label="Job title" className="da-input" value={opportunityForm.job_title} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, job_title: event.target.value }))} placeholder="Job title" /></div><textarea aria-label="Job description" className="da-textarea tracker-create-description" value={opportunityForm.job_description} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, job_description: event.target.value }))} maxLength={30000} placeholder="Paste the job description..." /><div className="tracker-create-footer"><span>{opportunityForm.job_description.length.toLocaleString()}/30,000 characters</span><button type="button" className="primary-button small" onClick={createOpportunity} disabled={opportunityActionLoading}><Sparkles size={14} /> Save opportunity</button></div></section>}

        <section className="tracker-kpi-strip" aria-label="Application summary">
          <article className="tracker-kpi"><span>Total roles</span><strong>{opportunities.length}</strong><small>Saved in your workspace</small></article>
          <article className="tracker-kpi"><span>Submitted</span><strong>{submittedCount}</strong><small>Applied, interview or offer</small></article>
          <article className="tracker-kpi"><span>Interviews</span><strong>{interviewCount}</strong><small>Active conversations</small></article>
          <article className="tracker-kpi"><span>Offers</span><strong>{offerCount}</strong><small>Positive outcomes</small></article>
        </section>

        {!!analyticsData?.upcoming_actions?.length && <section className="tracker-upcoming-strip"><div className="tracker-upcoming-label"><Clock3 size={14} /><span>Coming up</span></div>{analyticsData.upcoming_actions.slice(0, 3).map((item, index) => <button type="button" key={`${item.type}-${item.opportunity_id}-${item.date}-${index}`} className={`tracker-upcoming-item ${item.overdue ? "overdue" : ""}`} onClick={() => openSelectedOpportunity(item.opportunity_id)}><span><strong>{item.job_title}</strong><small>{item.type === "deadline" ? "Deadline" : "Follow-up"} Â· {item.company_name}</small></span><b>{formatAnalyticsAction(item)}</b></button>)}</section>}

        <section className="tracker-workbench">
          <div className="tracker-toolbar">
            <label className="tracker-search"><Search size={16} /><input type="search" value={opportunitySearch} onChange={(event) => setOpportunitySearch(event.target.value)} placeholder="Search company, role, or keyword..." aria-label="Search applications" />{opportunitySearch && <button type="button" onClick={() => setOpportunitySearch("")} aria-label="Clear search"><X size={14} /></button>}</label>
            <label className="tracker-filter"><ListFilter size={15} /><select value={opportunityStatusFilter} onChange={(event) => setOpportunityStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{OPPORTUNITY_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
            <div className="tracker-view-toggle" role="group" aria-label="Application view"><button type="button" className={opportunityView === "list" ? "active" : ""} aria-pressed={opportunityView === "list"} onClick={() => setOpportunityView("list")}>List</button><button type="button" className={opportunityView === "board" ? "active" : ""} aria-pressed={opportunityView === "board"} onClick={() => setOpportunityView("board")}>Board</button></div>
            <span className="tracker-result-count">{filteredOpportunities.length} of {opportunities.length}</span>
          </div>

          {opportunityView === "board" ? (
            <>
              {opportunityLoading ? <div className="tracker-empty-inline"><RefreshCw size={16} className="spin" /> Loading applications...</div> : filteredOpportunities.length ? renderBoard() : <div className="tracker-empty-inline"><Search size={16} /> No applications match these filters. <button type="button" className="text-button" onClick={() => { setOpportunitySearch(""); setOpportunityStatusFilter("all"); }}>Clear filters</button></div>}
              <section className="tracker-detail-panel tracker-board-detail">{renderSelectedDetails()}</section>
            </>
          ) : (
            <div className="tracker-main-grid">
              <section className="tracker-list-panel">
                <div className="tracker-list-heading"><div><div className="eyebrow">Your pipeline</div><h3>Applications <span>{filteredOpportunities.length}</span></h3></div><small>Choose a role to inspect it</small></div>
                {opportunityLoading ? <div className="tracker-empty-inline"><RefreshCw size={16} className="spin" /> Loading applications...</div> : !filteredOpportunities.length ? <div className="tracker-empty-inline"><Search size={16} /><span>{opportunities.length ? "No applications match these filters." : "Your pipeline is empty. Add your first role to begin."}</span><button type="button" className="text-button" onClick={() => { if (opportunities.length) { setOpportunitySearch(""); setOpportunityStatusFilter("all"); } else { setShowOpportunityForm(true); } }}>{opportunities.length ? "Clear filters" : "Add a role"}</button></div> : <div className="tracker-list-scroll">{filteredOpportunities.map(renderOpportunityCard)}</div>}
              </section>
              <section className="tracker-detail-panel">{renderSelectedDetails()}</section>
            </div>
          )}
        </section>
      </div>
    );
  };
  const renderHistory = () => (
    <div className="tab-content-active stack-lg">
      <div className="page-heading"><div><div className="eyebrow">History</div><h2>Your previous resume analyses.</h2><p>Keep track of roles you tested and revisit the recommendations.</p></div><button className="secondary-button" onClick={fetchHistory} disabled={historyLoading}><RefreshCw size={15} className={historyLoading ? "spin" : ""} /> Refresh</button></div>
      <section className="da-card history-card">
        {historyLoading ? <div className="empty-state"><RefreshCw size={24} className="spin" /><p>Loading history...</p></div> : !historyData.length ? <div className="empty-state"><History size={24} /><p>No analyses yet.</p><button className="secondary-button" onClick={() => goTo("analyze")}>Analyze a resume</button></div> : <div className="history-list">{historyData.map((h) => <button key={h.id} className="history-row" onClick={() => { try { setResult(typeof h.result === "string" ? JSON.parse(h.result) : h.result); } catch { setResult(null); } if (h.job_role) setJobRole(h.job_role); setAnalysisJobRole(h.job_role || ""); goTo("analyze"); }}><div className="history-row-icon"><FileText size={16} /></div><div className="history-row-copy"><strong>{h.job_role}</strong><span>{new Date(h.created_at).toLocaleString()}</span></div><strong className={`history-score ${getScoreTone(h.score)}`}>{h.score}/100</strong><ChevronRight size={16} className="muted-icon" /></button>)}</div>}
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
      <input
        id="resume-file"
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden-input"
      />
      <aside className={`dashboard-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand-block"><div className="brand-mark">R</div><div><strong>Resume<span>AI</span></strong><small>Career workspace</small></div></div>
        <nav className="side-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} className={`side-nav-item ${activeTab === id ? "active" : ""}`} onClick={() => goTo(id)}><Icon size={17} /><span>{label}</span>{activeTab === id && <span className="active-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-user"><div className="avatar">{(user?.name || "U").charAt(0).toUpperCase()}</div><div><strong>{user?.name || "User"}</strong><small>{user?.email || ""}</small></div></div>
          <button className="logout-button auth-change-password-button" onClick={() => navigate("/change-password")}>Change password</button>
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

        <div className={activeTab === "home" ? "dashboard-content dashboard-content-overview" : "dashboard-content"}>
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
