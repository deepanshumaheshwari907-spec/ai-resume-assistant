import React, { useState } from "react";
import axios from "axios";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";
import "./PasswordRecovery.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

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

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("Use at least 8 characters for your new password.");
    if (newPassword !== confirmPassword) return toast.error("The passwords do not match.");

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Your session has expired. Please sign in again.");
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_BASE}/auth/change-password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Password changed successfully.");
      logout();
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      toast.error(error?.response?.data?.detail || "We couldn't change your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <div className="auth-form-head">
        <div className="auth-eyebrow"><ShieldCheck size={13} /> ACCOUNT SECURITY</div>
        <h1>Change your password.</h1>
        <p>Keep your ResumeAI account secure with a password you control.</p>
      </div>

      <form className="auth-form password-recovery-form" onSubmit={submit}>
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          visible={showCurrent}
          onToggle={() => setShowCurrent((value) => !value)}
          autoComplete="current-password"
        />
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
          {loading ? "Changing password…" : "Update password"} <ArrowRight size={17} />
        </button>
      </form>

      <div className="password-recovery-footer">
        <Link to="/dashboard"><ArrowLeft size={14} /> Back to dashboard</Link>
        <span><ShieldCheck size={13} /> Secure account action</span>
      </div>
    </AuthLayout>
  );
}
