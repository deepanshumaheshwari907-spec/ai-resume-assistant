import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LandingPage.css";

// Only these routes are intentionally exposed to links inside the landing-page iframe.
const LANDING_APP_ROUTES = new Set(["/login", "/signup", "/dashboard", "/terms"]);

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const iframeRef = useRef(null);
  const src = useMemo(
    () => `/landing-pages/resumeai.html?logged=${user ? "1" : "0"}`,
    [user]
  );

  useEffect(() => {
    const onMessage = (event) => {
      // Accept route messages only from this page's own iframe, same origin,
      // and an explicit route allowlist. Ignore arbitrary or malformed messages.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "resumeai-route") return;
      const path = typeof event.data.path === "string" ? event.data.path : "";
      if (!LANDING_APP_ROUTES.has(path)) return;
      navigate(path);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  return (
    <div className="resumeai-kage-host">
      <iframe
        ref={iframeRef}
        className="resumeai-kage-frame"
        src={src}
        title="ResumeAI — Application Intelligence"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
      />
    </div>
  );
}
