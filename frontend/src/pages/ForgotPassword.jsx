import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import "./AuthPages.css";
import "./PasswordRecovery.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const getApiError = (error, fallback) =>
  error?.response?.data?.detail || fallback;

function OtpBoxes({ value, onChange, disabled }) {
  const inputs = useRef([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const setDigit = (index, next) => {
    const clean = next.replace(/\D/g, "").slice(-1);
    const chars = digits.map((d) => (d === " " ? "" : d));
    chars[index] = clean;
    const result = chars.join("").slice(0, 6);
    onChange(result);
    if (clean && inputs.current[index + 1]) inputs.current[index + 1].focus();
  };

  const onKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && inputs.current[index - 1]) {
      inputs.current[index - 1].focus();
    }
  };

  return (
    <div className="password-otp-row" aria-label="Six digit verification code">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(node) => { inputs.current[index] = node; }}
          className="auth-otp-input password-otp-input"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] === " " ? "" : digits[index]}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          disabled={disabled}
          aria-label={`Verification code digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input-wrap">
        <KeyRound size={17} />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="auth-input-action"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return toast.error("Enter your email address.");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/forgot-password`, { email: cleanEmail });
      setEmail(cleanEmail);
      setOtp("");
      setPhase("otp");
      setCooldown(60);
      toast.success("Check your email for the verification code.");
    } catch (error) {
      toast.error(getApiError(error, "We couldn't start password recovery."));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    await sendCode();
  };

  const verifyCode = async () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit verification code.");
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/verify-reset-otp`, {
        email,
        otp,
      });
      setResetToken(response.data.reset_token);
      setPhase("reset");
      toast.success("Email verified. Create your new password.");
    } catch (error) {
      toast.error(getApiError(error, "That code is invalid or expired."));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("Use at least 8 characters for your new password.");
    if (newPassword !== confirmPassword) return toast.error("The passwords do not match.");

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, {
        email,
        reset_token: resetToken,
        new_password: newPassword,
      });
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (error) {
      toast.error(getApiError(error, "We couldn't update your password."));
    } finally {
      setLoading(false);
    }
  };

  const heading = phase === "email" ? "Reset access." : phase === "otp" ? "Verify your email." : "Create a new password.";
  const copy = phase === "email"
    ? "Enter your ResumeAI email and we'll send a secure verification code."
    : phase === "otp"
      ? `We sent a 6-digit code to ${email}.`
      : "Choose a new password for your ResumeAI account.";

  return (
    <AuthLayout mode="login">
      <div className="auth-form-head">
        <div className="auth-eyebrow"><ShieldCheck size={13} /> ACCOUNT RECOVERY</div>
        <h1>{heading}</h1>
        <p>{copy}</p>
      </div>

      {phase === "email" && (
        <div className="auth-form password-recovery-form">
          <label className="auth-field">
            <span>Email address</span>
            <div className="auth-input-wrap">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
          </label>
          <button className="auth-submit" type="button" onClick={sendCode} disabled={loading}>
            {loading ? "Sending code…" : "Send verification code"} <ArrowRight size={17} />
          </button>
        </div>
      )}

      {phase === "otp" && (
        <div className="auth-form password-recovery-form">
          <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
          <button className="auth-submit" type="button" onClick={verifyCode} disabled={loading}>
            {loading ? "Verifying…" : "Verify code"} <ArrowRight size={17} />
          </button>
          <div className="auth-resend-row">
            <span>{cooldown > 0 ? `Resend available in ${cooldown}s` : "Didn't receive the code?"}</span>
            <button className="auth-link-button" type="button" onClick={resend} disabled={cooldown > 0 || loading}>
              Resend code
            </button>
          </div>
        </div>
      )}

      {phase === "reset" && (
        <form className="auth-form password-recovery-form" onSubmit={resetPassword}>
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            visible={showNew}
            onToggle={() => setShowNew((value) => !value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirm}
            onToggle={() => setShowConfirm((value) => !value)}
            autoComplete="new-password"
          />
          <div className={`password-rule ${newPassword.length >= 8 ? "ok" : ""}`}>
            <span>{newPassword.length >= 8 ? "✓" : "•"}</span> 8+ characters
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Updating password…" : "Set new password"} <ArrowRight size={17} />
          </button>
        </form>
      )}

      <div className="password-recovery-footer">
        <Link to="/login"><ArrowLeft size={14} /> Back to login</Link>
        <span><ShieldCheck size={13} /> Secure recovery</span>
      </div>
    </AuthLayout>
  );
}
