import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Fill all fields");
    if (password.length < 6) return toast.error("Password must be 6+ characters");
    if (!email.includes("@")) return toast.error("Enter valid email");
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success("Account created! Welcome 🎉");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "44px 40px", width: "100%", maxWidth: 420, position: "relative" }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
            Resume<span style={{ color: "#F59E0B" }}>AI</span>
          </div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>AI-Powered Resume Assistant</div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>Create free account 🚀</h2>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 28 }}>2 free analyses/month — no credit card needed</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 13, color: "#777", marginBottom: 6 }}>Full Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Rahul Sharma"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, color: "#777", marginBottom: 6 }}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, color: "#777", marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          <p style={{ fontSize: 12, color: "#444", marginBottom: 24 }}>Use at least 6 characters</p>

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: loading ? "#333" : "linear-gradient(135deg, #F59E0B, #F97316)", color: loading ? "#666" : "#000", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 20px rgba(245,158,11,0.3)" }}>
            {loading ? "Creating account..." : "Create Free Account →"}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", fontSize: 13, color: "#888", textAlign: "center" }}>
          ✓ Free forever &nbsp;·&nbsp; ✓ No credit card &nbsp;·&nbsp; ✓ Instant access
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#444" }}>
          Already have account?{" "}
          <Link to="/login" style={{ color: "#F59E0B", textDecoration: "none", fontWeight: 600 }}>Login</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <Link to="/" style={{ color: "#333", textDecoration: "none", fontSize: 13 }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}