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
    setLoading(true);
    try {
      await signup(name, email, password);
      toast.success("Account created! Welcome 🎉");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#13131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 400 }}>
        
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 24, textAlign: "center" }}>
          Resume<span style={{ color: "#F59E0B" }}>AI</span>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Create free account</h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 28, marginTop: 6 }}>2 free analyses/month — no credit card needed</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 13, color: "#999", marginBottom: 6 }}>Full Name</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Rahul Sharma"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />

          <label style={{ display: "block", fontSize: 13, color: "#999", marginBottom: 6, marginTop: 16 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />

          <label style={{ display: "block", fontSize: 13, color: "#999", marginBottom: 6, marginTop: 16 }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 8, background: "#0A0A0F", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#F59E0B", color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 24 }}>
            {loading ? "Creating account..." : "Create Free Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, color: "#666", fontSize: 14 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#F59E0B", textDecoration: "none" }}>Login</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 8 }}>
          <Link to="/" style={{ color: "#444", textDecoration: "none", fontSize: 13 }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}