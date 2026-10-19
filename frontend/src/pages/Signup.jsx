import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import "./AuthPages.css";

function Input({ icon: Icon, label, value, onChange, placeholder, type = "text", autoComplete, action }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input-wrap">
        <Icon size={16} strokeWidth={1.7} />
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} />
        {action}
      </div>
    </label>
  );
}

function OtpBox({ value, inputRef, onChange, onKeyDown, onPaste, index }) {
  return <input ref={inputRef} className="auth-otp-input" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={value} onChange={onChange} onKeyDown={onKeyDown} onPaste={onPaste} aria-label={`Verification digit ${index + 1}`} />;
}

export default function Signup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signup, googleLogin } = useAuth();
  const [phase, setPhase] = useState("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const verify = params.get("verify") === "1" || location.state?.verifyOnly;
    const queryEmail = params.get("email");
    if (verify) {
      setPhase("otp");
      if (queryEmail) setEmail(queryEmail);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [location.search, location.state]);

  const handleSignup = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) return toast.error("Use your full name.");
    if (!email.trim()) return toast.error("Enter a valid email address.");
    if (password.length < 6) return toast.error("Password must contain at least 6 characters.");
    setLoading(true);
    try {
      const res = await signup(name.trim(), email.trim(), password);
      setEmail(res?.email || email.trim());
      setPhase("otp");
      setOtp(["", "", "", "", "", ""]);
      setResendIn(60);
      toast.success("Verification code sent to your email.");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create your workspace.");
    } finally {
      setLoading(false);
    }
  };

  const updateOtp = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event, index) => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!value) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    value.split("").forEach((digit, offset) => { if (index + offset < 6) next[index + offset] = digit; });
    setOtp(next);
    otpRefs.current[Math.min(index + value.length, 5)]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return toast.error("Enter the 6-digit verification code.");
    setLoading(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiBase}/auth/verify-otp`, { email: email.trim(), otp: code });
      // Complete the auth handshake in the shared AuthContext before navigating.
      // This prevents ProtectedRoute from seeing a stale null user and bouncing
      // a newly-verified user back to /login or /signup.
      googleLogin(res.data.token, res.data.user);
      toast.success("Workspace verified. Welcome to ResumeAI.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "That verification code is not valid.");
      setOtp(["", "", "", "", "", ""]);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || resending || !email.trim()) return;
    setResending(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      await axios.post(`${apiBase}/auth/resend-otp`, { email: email.trim(), otp: "" });
      setOtp(["", "", "", "", "", ""]);
      setResendIn(60);
      toast.success("A new verification code has been sent.");
      otpRefs.current[0]?.focus();
    } catch (err) {
      const detail = String(err?.response?.data?.detail || "Could not resend the code.");
      const match = detail.match(/(\d+)s/);
      if (match) setResendIn(Number(match[1]));
      toast.error(detail);
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) return toast.error("Google Sign-In did not return a credential.");
    setLoading(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiBase}/auth/google`, { token: credentialResponse.credential });
      googleLogin(res.data.token, res.data.user);
      toast.success("Workspace created with Google.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Google Auth Error:", err);
      toast.error(err?.response?.data?.detail || "Google signup failed.");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "otp") {
    return (
      <AuthLayout mode="signup">
        <div className="auth-form-head">
          <span className="auth-form-kicker">02 / VERIFY YOUR WORKSPACE</span>
          <h2>Check your inbox.</h2>
          <p>We sent a 6-digit verification code to <strong className="auth-email-strong">{email}</strong>.</p>
        </div>

        <form className="auth-form" onSubmit={handleVerify}>
          <div className="otp-heading"><KeyRound size={15} /><span>EMAIL VERIFICATION</span></div>
          <div className="auth-otp-row">
            {otp.map((digit, index) => (
              <OtpBox key={index} index={index} value={digit} inputRef={(el) => { otpRefs.current[index] = el; }} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(event, index)} onPaste={(event) => handleOtpPaste(event, index)} />
            ))}
          </div>
          <div className="auth-verify-note"><Check size={13} /> This code activates your ResumeAI workspace.</div>
          <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? "Verifying…" : "Verify & enter workspace"}</span><ArrowRight size={16} /></button>
        </form>

        <div className="auth-resend-row"><span>Didn't receive the email?</span><button type="button" className="auth-link-button" onClick={handleResend} disabled={resendIn > 0 || resending}>{resending ? "Sending…" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button></div>

        <button className="auth-back-action" type="button" onClick={() => setPhase("details")}><ArrowLeft size={14} /> Change email or profile</button>
        <div className="auth-footnote">Didn't receive the message? Check Spam/Promotions, then return to the form and start the verification request again.</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout mode="signup">
      <div className="auth-form-head">
        <span className="auth-form-kicker">01 / CREATE WORKSPACE</span>
        <h2>Start with your resume.</h2>
        <p>Create your account, verify your email, then enter the application workspace.</p>
      </div>

      <form className="auth-form" onSubmit={handleSignup}>
        <Input icon={UserRound} label="FULL NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
        <Input icon={Mail} label="EMAIL ADDRESS" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        <Input icon={LockKeyhole} label="PASSWORD" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" action={(
          <button className="auth-field-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )} />

        <div className="password-rule"><span className={password.length >= 6 ? "ok" : ""}>{password.length >= 6 ? "✓" : "—"} Minimum 6 characters</span><span className="muted">Stored securely</span></div>
        <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? "Creating workspace…" : "Create your workspace"}</span><ArrowRight size={16} /></button>
      </form>

      <div className="auth-divider"><span>OR</span></div>
      <div className="google-wrap"><GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error("Google Sign-In failed.")} theme="outline" shape="rectangular" width="400" text="continue_with" size="large" /></div>
      <div className="auth-switch"><span>Already have an account?</span><Link to="/login">Sign in <ArrowRight size={13} /></Link></div>
      <div className="auth-footnote">By creating a workspace, you agree to use accurate application information and to the ResumeAI terms.</div>
    </AuthLayout>
  );
}
