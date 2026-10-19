import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
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

export default function Login() {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return toast.error("Enter your email and password.");
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back to ResumeAI.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail || "Invalid email or password.";
      if (err?.response?.status === 403 && /verification|required/i.test(String(detail))) {
        toast.error("Email verification required. We sent you a new code.");
        navigate(`/signup?verify=1&email=${encodeURIComponent(email.trim())}`, { replace: true });
      } else {
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) return toast.error("Google Sign-In did not return a credential.");
    setLoading(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiBase}/auth/google`, { token: credentialResponse.credential });
      googleLogin(res.data.token, res.data.user);
      toast.success("Google sign-in successful.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Google Auth Error:", err);
      toast.error(err?.response?.data?.detail || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <div className="auth-form-head">
        <span className="auth-form-kicker">01 / RETURN TO WORKSPACE</span>
        <h2>Welcome back.</h2>
        <p>Sign in to continue building your next application.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <Input icon={Mail} label="EMAIL ADDRESS" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        <Input
          icon={LockKeyhole}
          label="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          action={(
            <button className="auth-field-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        />

        <div className="auth-password-row">
          <div className="auth-form-meta">
            <span><ShieldCheck size={12} /> Secure workspace access</span>
            <span>JWT SESSION</span>
          </div>
          <Link className="auth-forgot-link" to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          <span>{loading ? "Signing you in…" : "Continue to workspace"}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="auth-divider"><span>OR</span></div>

      <div className="google-wrap">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => toast.error("Google Sign-In failed.")}
          theme="outline"
          shape="rectangular"
          width="400"
          text="continue_with"
          size="large"
        />
      </div>

      <div className="auth-switch">
        <span>New to ResumeAI?</span>
        <Link to="/signup">Create your workspace <ArrowRight size={13} /></Link>
      </div>

      <div className="auth-footnote">By continuing, you agree to use ResumeAI as an application workspace and keep your submitted information accurate.</div>
    </AuthLayout>
  );
}
