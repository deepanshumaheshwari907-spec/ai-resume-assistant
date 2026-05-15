import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif", textAlign: "center", padding: 20 }}>
      <div>
        <div style={{ fontSize: 80, marginBottom: 16 }}>😕</div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: "#fff", marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 18, color: "#555", marginBottom: 32 }}>Page not found</p>
        <button onClick={() => navigate("/")}
          style={{ padding: "13px 32px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Go Home →
        </button>
      </div>
    </div>
  );
}