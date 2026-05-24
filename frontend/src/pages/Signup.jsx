import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import { User, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";

export default function Signup() {
  const { signup } = useAuth();

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP Flow States
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Handle Initial Signup Submit
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Please fill all fields");
    
    setLoading(true);
    try {
      const data = await signup(name, email, password);
      toast.success(data.message || "OTP sent to your email! ✉️");
      setShowOtpScreen(true); // Switch to OTP Screen layout dynamically
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification & Local Storage Session Mapping
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Please enter a valid 6-digit OTP");

    setOtpLoading(true);
    try {
      // Post validation credentials directly to the core backend router
      const res = await api.post("/auth/verify-otp", { email, otp });
      toast.success("Account verified successfully! 🎉");
      
      // Locking authentication payload securely inside local states
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user)); // 👈 Ye dashboard profile validation ke liye jodd diya hai
      
      // Enforcing structural application refresh to clean contextual layout components safely
      window.location.href = "/dashboard"; 
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid OTP code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff" }}>
      
      {/* Background Decorative Radial Glows */}
      <div style={{ position: "absolute", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%)", top: "10%", left: "15%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(79, 70, 229, 0.03) 0%, transparent 70%)", bottom: "10%", right: "15%", pointerEvents: "none" }} />

      <div className="premium-card animate-fade-in" style={{ width: "100%", maxWidth: "420px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "24px", padding: "32px", backdropFilter: "blur(20px)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
        
        {/* LOGO STANDARDS */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em" }}>Resume<span style={{ color: "#F59E0B" }}>AI</span></div>
          <p style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>The Intelligent Recruiter Pipeline Layer</p>
        </div>

        {!showOtpScreen ? (
          /* REGULAR SIGNUP FORM LAYOUT */
          <form onSubmit={handleSignupSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#888", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Full Name</label>
              <div style={{ position: "relative" }}>
                <User size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#555" }} />
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="premium-input" style={{ width: "100%", padding: "12px 14px 12px 42px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#888", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#555" }} />
                <input type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} className="premium-input" style={{ width: "100%", padding: "12px 14px 12px 42px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#888", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#555" }} />
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="premium-input" style={{ width: "100%", padding: "12px 14px 12px 42px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: loading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: loading ? "#444" : "#000", fontWeight: 700, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "10px", transition: "all 0.2s" }}>
              {loading ? "Dispatched Security Signals..." : "Create Premium Account"} <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: "center", fontSize: "13px", color: "#666", marginTop: "10px" }}>
              Already registered? <Link to="/login" style={{ color: "#F59E0B", textDecoration: "none", fontWeight: 600 }}>Sign In</Link>
            </div>
          </form>
        ) : (
          /* PREMIUM GLASSMORPHIC OTP SCREEN LAYOUT */
          <form onSubmit={handleOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ textAlign: "center", background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.1)", padding: "12px", borderRadius: "12px", marginBottom: "4px" }}>
              <p style={{ fontSize: "13px", color: "#ccc", lineHeight: "1.5" }}>We have sent a verification security key to <br/><span style={{ color: "#F59E0B", fontWeight: 600 }}>{email}</span></p>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#888", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Enter 6-Digit Verification Code</label>
              <div style={{ position: "relative" }}>
                <ShieldCheck size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#F59E0B" }} />
                <input type="text" maxLength="6" placeholder="e.g. 123456" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className="premium-input" style={{ width: "100%", padding: "13px 14px 13px 44px", fontSize: "16px", fontWeight: "bold", letterSpacing: "4px", textAlign: "center", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <button type="submit" disabled={otpLoading} style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: otpLoading ? "#1a1a2a" : "linear-gradient(135deg, #F59E0B, #F97316)", color: otpLoading ? "#444" : "#000", fontWeight: 800, fontSize: "14px", cursor: otpLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", boxShadow: "0 4px 20px rgba(245,158,11,0.15)" }}>
              {otpLoading ? "Verifying Credentials..." : "Activate Dashboard Access 🎉"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button type="button" onClick={() => setShowOtpScreen(false)} style={{ background: "transparent", border: "none", color: "#666", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
                ← Back to registration details
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}