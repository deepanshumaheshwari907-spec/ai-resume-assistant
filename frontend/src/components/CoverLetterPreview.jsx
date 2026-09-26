import jsPDF from "jspdf";
import "./CoverLetterPreview.css";

const normalize = (value) => String(value ?? "").trim();

function splitParagraphs(value) {
  return normalize(value)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function downloadCoverLetterPdf(letter, companyName = "Company", jobTitle = "Role") {
  const text = normalize(letter);
  if (!text) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const width = 210 - margin * 2;
  const bottom = 282;
  let y = 22;

  const ensureSpace = (needed) => {
    if (y + needed <= bottom) return;
    doc.addPage();
    y = 22;
  };

  const write = (value, size = 10.3, lineHeight = 5.2, bold = false, after = 1.8) => {
    const clean = normalize(value);
    if (!clean) return;
    doc.setFont("Helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(clean, width);
    ensureSpace(lines.length * lineHeight + after);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + after;
  };

  doc.setProperties({
    title: `${companyName} — ${jobTitle} Cover Letter`,
    subject: "Job application cover letter",
  });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(25, 25, 25);
  doc.text("COVER LETTER", margin, y);
  y += 6;

  write(`${jobTitle} • ${companyName}`, 9.2, 4.5, false, 2);

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.45);
  doc.line(margin, y, 210 - margin, y);
  y += 9;

  splitParagraphs(text).forEach((paragraph) => {
    write(paragraph, 10.3, 5.2, false, 3.4);
  });

  const safeCompany = String(companyName || "company")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  const safeRole = String(jobTitle || "role")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  doc.save(`${safeCompany || "company"}-${safeRole || "role"}-cover-letter.pdf`);
}

export default function CoverLetterPreview({
  letter,
  companyName,
  jobTitle,
  onCopy,
  onRegenerate,
  loading = false,
}) {
  if (!normalize(letter)) {
    return (
      <div className="cover-letter-empty">
        <p>No cover letter has been generated yet.</p>
      </div>
    );
  }

  const paragraphs = splitParagraphs(letter);

  return (
    <div className="cover-letter-preview-wrap">
      <article className="cover-letter-paper">
        <header className="cover-letter-header">
          <div>
            <div className="eyebrow">Application asset</div>
            <h3>Cover letter ready</h3>
            <p>
              Tailored for {jobTitle || "this role"} at {companyName || "the company"}.
            </p>
          </div>
          <span className="soft-badge">Saved</span>
        </header>

        <div className="cover-letter-meta">
          <strong>{jobTitle || "Target role"}</strong>
          <span>{companyName || "Company"}</span>
        </div>

        <div className="cover-letter-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
          ))}
        </div>

        <div className="cover-letter-actions">
          <button className="secondary-button small" onClick={onCopy} type="button">
            Copy
          </button>
          <button
            className="secondary-button small"
            onClick={() => downloadCoverLetterPdf(letter, companyName, jobTitle)}
            type="button"
          >
            Download PDF
          </button>
          <button
            className="primary-button small"
            onClick={onRegenerate}
            disabled={loading}
            type="button"
          >
            {loading ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </article>
    </div>
  );
}
