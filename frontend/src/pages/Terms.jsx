import { useNavigate } from "react-router-dom";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button onClick={() => navigate("/")} style={{ background: "transparent", border: "none", color: "#F59E0B", cursor: "pointer", fontSize: 14, marginBottom: 32 }}>← Back to Home</button>
        
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: "#555", marginBottom: 40 }}>Last updated: May 2026</p>

        {[
          { title: "1. Acceptance of Terms", content: "By using ResumeAI, you agree to these terms. If you disagree, please do not use our service." },
          { title: "2. Service Description", content: "ResumeAI provides AI-powered resume analysis, rewriting, and interview preparation tools. We use third-party AI services to generate recommendations." },
          { title: "3. User Accounts", content: "You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information during registration." },
          { title: "4. Free & Paid Plans", content: "Free plan includes 2 resume analyses per month. Pro plan (₹199/month) includes unlimited analyses and additional features. Payments are non-refundable." },
          { title: "5. Privacy", content: "We collect your email, name, and resume content to provide our service. We do not sell your personal data to third parties." },
          { title: "6. Intellectual Property", content: "ResumeAI and its content are owned by us. You retain ownership of your resume content." },
          { title: "7. Limitation of Liability", content: "ResumeAI is provided as-is. We are not responsible for job outcomes based on our recommendations." },
          { title: "8. Contact", content: "For questions, email us at: deepanshumaheshwari907@gmail.com" },
        ].map((s) => (
          <div key={s.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: "#F59E0B" }}>{s.title}</h2>
            <p style={{ fontSize: 15, color: "#888", lineHeight: 1.7 }}>{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}