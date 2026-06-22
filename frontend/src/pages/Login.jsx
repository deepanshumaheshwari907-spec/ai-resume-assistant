import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { GoogleLogin } from '@react-oauth/google';
import axios from "axios"; // Agar axios use kar rahe ho backend hit karne ke liye

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth(); // Agar aapke context mein koi special googleLogin function hai toh wo bhi add kar sakte hain
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Fill all fields");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back! 🎉");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally { setLoading(false); }
  };

  // Google Login Success Handler
  const handleGoogleSuccess = async (credentialResponse) => {
  setLoading(true);

  try {
    const res = await axios.post(
      "https://resumeai-backend-nv09.onrender.com/auth/google",
      {
        token: credentialResponse.credential,
      }
    );

    googleLogin(
      res.data.token,
      res.data.user
    );

    toast.success("Google Login Successful! 🚀");

    navigate("/dashboard", { replace: true });

  } catch (err) {
    console.error("Google Auth Error:", err);

    toast.error(
      err.response?.data?.detail ||
      "Google login failed"
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      
      {/* Glow */}
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "44px 40px", width: "100%", maxWidth: 420, position: "relative" }}>
        
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
            Resume<span style={{ color: "#F59E0B" }}>AI</span>
          </div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>AI-Powered Resume Assistant</div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Welcome back 👋</h2>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 28 }}>Login to continue improving your resume</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 13, color: "#777", marginBottom: 6 }}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          />
          
          <label style={{ display: "block", fontSize: 13, color: "#777", marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 24 }}
          />

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: loading ? "#333" : "linear-gradient(135deg, #F59E0B, #F97316)", color: loading ? "#666" : "#000", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 20px rgba(245,158,11,0.3)" }}>
            {loading ? "Logging in..." : "Login to Dashboard →"}
          </button>
        </form>

        {/* --- OR Divider --- */}
        <div style={{ display: "flex", alignItems: "center", margin: "24px 0", color: "#444", fontSize: 12, fontWeight: 600 }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          <span style={{ padding: "0 10px", textTransform: "uppercase", letterSpacing: "1px" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* --- Google Login Button --- */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              toast.error("Google Sign-In Failed");
            }}
            theme="filled_dark"
            shape="rectangular"
            width="340px"
          />
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#444" }}>
          No account?{" "}
          <Link to="/signup" style={{ color: "#F59E0B", textDecoration: "none", fontWeight: 600 }}>Sign up free</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link to="/" style={{ color: "#333", textDecoration: "none", fontSize: 13 }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}