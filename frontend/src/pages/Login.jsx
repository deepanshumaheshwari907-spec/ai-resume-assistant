import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import api from "../utils/api";
import { Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [showOtpScreen, setShowOtpScreen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      // Normal login through AuthContext
      await login(email.trim(), password);

      toast.success("Welcome back! 🎉");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // Backend tells us user needs email verification.
      if (
        status === 403 &&
        typeof detail === "string" &&
        detail.toLowerCase().includes("email verification required")
      ) {
        setShowOtpScreen(true);
        toast.success(
          "A new verification code has been sent to your email."
        );
        return;
      }

      toast.error(detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setOtpLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email: email.trim(),
        otp,
      });

      // Save authenticated session
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      toast.success("Email verified successfully! 🎉");

      // Hard navigation reloads AuthContext with the new stored user.
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          "Invalid or expired verification code"
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const goBackToLogin = () => {
    setShowOtpScreen(false);
    setOtp("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080810",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 22,
          padding: "42px 38px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.5px",
            }}
          >
            Resume<span style={{ color: "#F59E0B" }}>AI</span>
          </div>

          <div
            style={{
              fontSize: 13,
              color: "#555",
              marginTop: 5,
            }}
          >
            AI-Powered Resume Assistant
          </div>
        </div>

        {!showOtpScreen ? (
          <>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                margin: "0 0 7px",
              }}
            >
              Welcome back 👋
            </h2>

            <p
              style={{
                color: "#666",
                fontSize: 14,
                margin: "0 0 28px",
              }}
            >
              Login to continue improving your resume
            </p>

            <form onSubmit={handleLogin}>
              {/* Email */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#888",
                  marginBottom: 7,
                }}
              >
                Email Address
              </label>

              <div style={{ position: "relative", marginBottom: 18 }}>
                <Mail
                  size={17}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#555",
                  }}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "13px 14px 13px 43px",
                    borderRadius: 11,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Password */}
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#888",
                  marginBottom: 7,
                }}
              >
                ResumeAI Password
              </label>

              <div style={{ position: "relative", marginBottom: 24 }}>
                <Lock
                  size={17}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#555",
                  }}
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "13px 14px 13px 43px",
                    borderRadius: 11,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 11,
                  border: "none",
                  background: loading
                    ? "#333"
                    : "linear-gradient(135deg,#F59E0B,#F97316)",
                  color: loading ? "#666" : "#000",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: loading
                    ? "none"
                    : "0 4px 20px rgba(245,158,11,0.25)",
                }}
              >
                {loading ? "Signing in..." : "Login to Dashboard"}
                <ArrowRight size={17} />
              </button>
            </form>

            <div
              style={{
                textAlign: "center",
                marginTop: 25,
                fontSize: 14,
                color: "#555",
              }}
            >
              No account?{" "}
              <Link
                to="/signup"
                style={{
                  color: "#F59E0B",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Sign up free
              </Link>
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: 14,
              }}
            >
              <Link
                to="/"
                style={{
                  color: "#444",
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                ← Back to home
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* OTP Screen */}
            <div style={{ textAlign: "center", marginBottom: 25 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  background: "rgba(245,158,11,0.10)",
                  border: "1px solid rgba(245,158,11,0.20)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={25} color="#F59E0B" />
              </div>

              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  margin: "0 0 8px",
                }}
              >
                Verify your email
              </h2>

              <p
                style={{
                  color: "#666",
                  fontSize: 14,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                We sent a 6-digit verification code to
              </p>

              <div
                style={{
                  marginTop: 7,
                  color: "#F59E0B",
                  fontSize: 14,
                  fontWeight: 700,
                  wordBreak: "break-all",
                }}
              >
                {email}
              </div>
            </div>

            <form onSubmit={handleOtpVerify}>
              <label
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#888",
                  marginBottom: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Verification Code
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, ""))
                }
                placeholder="123456"
                autoFocus
                style={{
                  width: "100%",
                  padding: "15px",
                  borderRadius: 11,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "8px",
                  textAlign: "center",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="submit"
                disabled={otpLoading}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 11,
                  border: "none",
                  background: otpLoading
                    ? "#333"
                    : "linear-gradient(135deg,#F59E0B,#F97316)",
                  color: otpLoading ? "#666" : "#000",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: otpLoading ? "not-allowed" : "pointer",
                }}
              >
                {otpLoading
                  ? "Verifying..."
                  : "Verify & Continue →"}
              </button>
            </form>

            <div
              style={{
                textAlign: "center",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={goBackToLogin}
                style={{
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                  fontSize: 13,
                  textDecoration: "underline",
                }}
              >
                ← Back to login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}