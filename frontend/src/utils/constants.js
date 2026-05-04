export const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export const PLANS = {
  free: {
    name: "Free",
    analysisLimit: 2,
    canRewrite: false,
    canInterview: false,
    canDownloadPDF: false,
  },
  pro: {
    name: "Pro",
    analysisLimit: Infinity,
    canRewrite: true,
    canInterview: true,
    canDownloadPDF: true,
  },
  elite: {
    name: "Elite",
    analysisLimit: Infinity,
    canRewrite: true,
    canInterview: true,
    canDownloadPDF: true,
    canMatchJD: true,
  },
};