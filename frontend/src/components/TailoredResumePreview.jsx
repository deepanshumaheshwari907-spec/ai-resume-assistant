import jsPDF from "jspdf";
import "./TailoredResumePreview.css";

const SECTION_ORDER = ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "KEY STRENGTHS", "ACHIEVEMENTS"];
const normalize = (value) => String(value ?? "").trim();
const contactDedupeKey = (value) => normalize(value)
  .replace(/^(?:Email|E-mail|Phone|Mobile|Tel|LinkedIn|GitHub|Portfolio|Website)\s*:\s*/i, "")
  .toLocaleLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .replace(/[/\\ \t]+$/g, "");
const normalizeEducationDetail = (value) => {
  const text = normalize(value);
  return /^coursework\s*:/i.test(text)
    ? text.replace(/\bComputer Vision\s+(?=Natural Language Processing\b)/i, "Computer Vision, ")
    : text;
};
const isPlaceholder = (value) => /^(?:untitled|unknown|not specified|not provided|n\/?a|none|null|placeholder|tbd)$/i.test(normalize(value));

function splitContactValues(items, location = "") {
  const parts = (Array.isArray(items) ? items : [items])
    .flatMap((item) => normalize(item).split(/\s*[|•·]\s*/))
    .map((part) => part.replace(/^(?:Email|E-mail|Phone|Mobile|Tel|LinkedIn|GitHub|Portfolio|Website)\s*:\s*/i, "").trim())
    .filter(Boolean);
  const locationKey = normalize(location).toLocaleLowerCase().replace(/[ ,]+$/g, "");
  const seen = new Set();
  return parts.filter((part) => {
    const key = contactDedupeKey(part);
    if (!key || (locationKey && key.replace(/[ ,]+$/g, "") === contactDedupeKey(locationKey)) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanResumeModel(model) {
  if (!model || typeof model !== "object") return model;
  const cleanEntries = (items, kind) => (Array.isArray(items) ? items : []).filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const title = kind === "project" ? entry.name : kind === "education" ? entry.degree : entry.title;
    const usableTitle = !isPlaceholder(title) && Boolean(normalize(title));
    const other = kind === "education"
      ? [entry.institution, entry.dates, ...(entry.details || [])]
      : kind === "project"
        ? [entry.dates, ...(entry.technologies || []), ...(entry.bullets || [])]
        : [entry.company, entry.dates, ...(entry.bullets || [])];
    return usableTitle || other.some((value) => !isPlaceholder(value) && Boolean(normalize(value)));
  });

  const contact_items = splitContactValues(model.contact_items, model.location);
  const contactKeys = new Set(contact_items.map(contactDedupeKey));
  const links = splitContactValues(model.links, model.location).filter((item) => !contactKeys.has(contactDedupeKey(item)));

  return {
    ...model,
    contact_items,
    links,
    experience: cleanEntries(model.experience, "experience"),
    projects: cleanEntries(model.projects, "project"),
    education: cleanEntries(model.education, "education").map((entry) => ({
      ...entry,
      degree: isPlaceholder(entry.degree) ? "" : entry.degree,
      institution: isPlaceholder(entry.institution) ? "" : entry.institution,
      details: (Array.isArray(entry.details) ? entry.details : []).map(normalizeEducationDetail),
    })),
    certifications: (Array.isArray(model.certifications) ? model.certifications : []).filter((item) => !isPlaceholder(item)),
    key_strengths: (Array.isArray(model.key_strengths) ? model.key_strengths : []).filter((item) => !isPlaceholder(item)),
    achievements: (Array.isArray(model.achievements) ? model.achievements : []).filter((item) => !isPlaceholder(item)),
  };
}

export function parseTailoredResume(value) {
  if (!value) return null;
  if (typeof value === "object" && value.format_version === 1) return cleanResumeModel(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && parsed.format_version === 1) return cleanResumeModel(parsed);
    } catch {}
  }
  return null;
}

function parseLegacyResume(value) {
  const text = normalize(value);
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const sections = {};
  let current = "HEADER";
  sections[current] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { sections[current].push(""); continue; }
    const heading = SECTION_ORDER.find((item) => trimmed.toUpperCase() === item);
    if (heading) { current = heading; sections[current] = []; continue; }
    sections[current].push(trimmed);
  }
  const clean = (items = []) => items.filter((item, index) => item || items[index - 1]);
  const header = clean(sections.HEADER || []);
  return {
    format_version: 0,
    name: header[0] || "",
    headline: header[1] || "",
    contact_items: header.slice(2),
    links: [],
    location: "",
    summary: clean(sections.SUMMARY || []).join(" "),
    skills: [{ category: "Skills", skills: clean(sections.SKILLS || []).flatMap((line) => line.split(/[|,]/).map((part) => part.trim()).filter(Boolean)) }].filter((group) => group.skills.length),
    experience: legacyEntries(sections.EXPERIENCE || []),
    projects: legacyProjects(sections.PROJECTS || []),
    education: legacyEntries(sections.EDUCATION || []),
    certifications: clean(sections.CERTIFICATIONS || []),
    key_strengths: clean(sections["KEY STRENGTHS"] || []),
    achievements: clean(sections.ACHIEVEMENTS || []),
  };
}

function legacyEntries(lines) {
  const entries = [];
  let current = null;
  for (const line of lines.filter(Boolean)) {
    const bullet = line.replace(/^[-•]\s*/, "").trim();
    if (!line.startsWith("-") && !line.startsWith("•") && !line.startsWith("*")) {
      if (current) entries.push(current);
      current = { title: bullet, company: "", dates: "", bullets: [] };
    } else if (current) current.bullets.push(bullet);
    else current = { title: "", company: "", dates: "", bullets: [bullet] };
  }
  if (current) entries.push(current);
  return entries.filter((entry) => entry.title || entry.bullets.length);
}

function legacyProjects(lines) {
  const entries = [];
  let current = null;
  for (const raw of lines.filter(Boolean)) {
    const line = raw.trim();
    const bullet = line.replace(/^[-•]\s*/, "").trim();
    if (!line.startsWith("-") && !line.startsWith("•") && !line.startsWith("*")) {
      if (current) entries.push(current);
      current = { name: bullet, dates: "", technologies: [], bullets: [] };
      if (/\|/.test(bullet)) {
        const parts = bullet.split("|").map((item) => item.trim());
        current.name = parts[0] || "";
        current.dates = parts[1] || "";
      }
    } else if (current) {
      if (/^technolog(?:y|ies):/i.test(bullet)) current.technologies = bullet.replace(/^technolog(?:y|ies):/i, "").split(",").map((item) => item.trim()).filter(Boolean);
      else current.bullets.push(bullet);
    }
  }
  if (current) entries.push(current);
  return entries.filter((entry) => entry.name || entry.bullets.length);
}

export function resumeToPlainText(value) {
  const model = parseTailoredResume(value) || parseLegacyResume(value);
  if (!model) return "";
  const lines = [];
  if (model.name) lines.push(model.name);
  if (model.headline) lines.push(model.headline);
  const contacts = [...(model.contact_items || []), ...(model.links || [])].map(normalize).filter(Boolean);
  if (contacts.length) lines.push(contacts.join(" | "));
  if (model.location) lines.push(model.location);
  if (model.summary) lines.push("", "SUMMARY", model.summary);
  if (model.skills?.length) { lines.push("", "SKILLS"); model.skills.forEach((group) => { if (group.skills?.length) lines.push(group.category + ": " + group.skills.join(", ")); }); }
  if (model.experience?.length) { lines.push("", "EXPERIENCE"); model.experience.forEach((entry) => { lines.push([entry.title, entry.company, entry.dates].filter(Boolean).join(" | ")); (entry.bullets || []).forEach((bullet) => lines.push("- " + bullet)); }); }
  if (model.projects?.length) { lines.push("", "PROJECTS"); model.projects.forEach((project) => { lines.push([project.name, project.dates].filter(Boolean).join(" | ")); if (project.technologies?.length) lines.push("Technologies: " + project.technologies.join(", ")); (project.bullets || []).forEach((bullet) => lines.push("- " + bullet)); }); }
  if (model.education?.length) { lines.push("", "EDUCATION"); model.education.forEach((entry) => { lines.push([entry.degree, entry.institution, entry.dates].filter(Boolean).join(" | ")); (entry.details || []).forEach((detail) => lines.push(detail)); }); }
  if (model.certifications?.length) { lines.push("", "CERTIFICATIONS"); model.certifications.forEach((item) => lines.push("- " + item)); }
  if (model.key_strengths?.length) { lines.push("", "KEY STRENGTHS"); model.key_strengths.forEach((item) => lines.push("- " + item)); }
  if (model.achievements?.length) { lines.push("", "ACHIEVEMENTS"); model.achievements.forEach((item) => lines.push("- " + item)); }
  return lines.join("\n").trim();
}

const renderEntries = (items, kind) => items.map((entry, index) => {
  const title = kind === "project" ? entry.name : kind === "education" ? entry.degree : entry.title;
  const meta = kind === "project"
    ? [entry.dates].filter(Boolean).join(" • ")
    : kind === "education"
      ? [entry.institution, entry.dates].filter(Boolean).join(" • ")
      : [entry.company, entry.dates].filter(Boolean).join(" • ");
  return <div className="tailored-resume-entry" key={(title || "entry") + "-" + index}>
    <div className="tailored-resume-entry-top">{title && !isPlaceholder(title) && <strong>{title}</strong>}{meta && <span>{meta}</span>}</div>
    {kind === "project" && entry.technologies?.length > 0 && <div className="tailored-resume-tech"><span>Technologies</span><span>{entry.technologies.join(" • ")}</span></div>}
    {kind === "education" && entry.details?.map((detail, detailIndex) => <div className="tailored-resume-detail" key={detail + "-" + detailIndex}>{detail}</div>)}
    {!!entry.bullets?.length && <ul className="tailored-resume-bullets">{entry.bullets.map((bullet, bulletIndex) => <li key={bullet + "-" + bulletIndex}>{bullet}</li>)}</ul>}
  </div>;
});

function Section({ title, children }) { return <section className="tailored-resume-section"><h4>{title}</h4><div>{children}</div></section>; }

export default function TailoredResumePreview({ value }) {
  const model = parseTailoredResume(value) || parseLegacyResume(value);
  if (!model) return <div className="tailored-resume-empty"><p>No tailored resume is available yet.</p></div>;
  const contactLine = [...(model.contact_items || []), ...(model.links || [])].map(normalize).filter(Boolean).join(" • ");
  return <div className="tailored-resume-preview-wrap"><article className="tailored-resume-paper">
    <header className="tailored-resume-header">
      <h2>{model.name || "Tailored Resume"}</h2>
      {model.headline && <p className="tailored-resume-headline">{model.headline}</p>}
      {contactLine && <p className="tailored-resume-contact">{contactLine}</p>}
      {model.location && <p className="tailored-resume-location">{model.location}</p>}
    </header>
    {model.summary && <Section title="Summary"><p className="tailored-resume-summary">{model.summary}</p></Section>}
    {!!model.skills?.length && <Section title="Skills"><div className="tailored-resume-skills">{model.skills.map((group, index) => <div className="tailored-resume-skill-row" key={(group.category || "skills") + "-" + index}><strong>{group.category}</strong><span>{(group.skills || []).join(" • ")}</span></div>)}</div></Section>}
    {!!model.experience?.length && <Section title="Experience">{renderEntries(model.experience, "experience")}</Section>}
    {!!model.projects?.length && <Section title="Projects">{renderEntries(model.projects, "project")}</Section>}
    {!!model.education?.length && <Section title="Education">{renderEntries(model.education, "education")}</Section>}
    {!!model.certifications?.length && <Section title="Certifications"><ul className="tailored-resume-simple-list">{model.certifications.map((item, index) => <li key={item + "-" + index}>{item}</li>)}</ul></Section>}
    {!!model.key_strengths?.length && <Section title="Key Strengths"><ul className="tailored-resume-simple-list">{model.key_strengths.map((item, index) => <li key={item + "-" + index}>{item}</li>)}</ul></Section>}
    {!!model.achievements?.length && <Section title="Achievements"><ul className="tailored-resume-simple-list">{model.achievements.map((item, index) => <li key={item + "-" + index}>{item}</li>)}</ul></Section>}
  </article></div>;
}

// RESUMEAI_PDF_V2
function addPdfText(doc, text, x, y, width, options = {}) {
  const {
    size = 9.0,
    bold = false,
    lineHeight = 4.15,
    color = [36, 36, 36],
    after = 0.7,
  } = options;

  const value = normalize(text);
  if (!value) return y;

  doc.setFont("Helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(value, width);
  if (!lines.length) return y;

  doc.text(lines, x, y);
  return y + lines.length * lineHeight + after;
}

export function downloadTailoredResumePdf(value, targetRole = "Tailored Resume") {
  const model = parseTailoredResume(value) || parseLegacyResume(value);
  if (!model) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Compact single-column A4 layout optimized for a one-page fresher resume.
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const bottomLimit = 285;
  let y = 18;

  doc.setProperties({
    title: model.name ? `${model.name} — Resume` : "Resume",
    subject: targetRole,
  });

  // Header
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(24, 24, 24);
  doc.text(model.name || "Resume", margin, y);
  y += 6.5;

  const headline = normalize(model.headline);
  if (headline) {
    y = addPdfText(doc, headline, margin, y, contentWidth, {
      size: 9.7,
      color: [80, 80, 80],
      after: 0.8,
    });
  }

  const contacts = [
    ...(model.contact_items || []),
    ...(model.links || []),
  ]
    .map(normalize)
    .filter(Boolean);

  if (contacts.length) {
    y = addPdfText(doc, contacts.join(" | "), margin, y, contentWidth, {
      size: 8.0,
      color: [82, 82, 82],
      after: 0.45,
    });
  }

  if (model.location) {
    y = addPdfText(doc, model.location, margin, y, contentWidth, {
      size: 8.0,
      color: [82, 82, 82],
      after: 1.8,
    });
  }

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.55);
  doc.line(margin, y, 210 - margin, y);
  y += 5.2;

  const startNewPage = () => {
    doc.addPage();
    y = 17;
  };

  const estimateLines = (text, width, size) => {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(normalize(text), width).length;
  };

  const ensureSpace = (needed) => {
    if (y + needed <= bottomLimit) return;
    startNewPage();
  };

  const sectionTitle = (title, estimatedBody = 8) => {
    ensureSpace(7 + estimatedBody);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.7);
    doc.setTextColor(24, 24, 24);
    doc.text(title.toUpperCase(), margin, y);

    y += 4.7;

    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.22);
    doc.line(margin, y - 1.6, 210 - margin, y - 1.6);
    y += 1.2;
  };

  const writeBullet = (textValue, indent = 4.2) => {
    const value = normalize(textValue);
    if (!value) return;

    const size = 8.5;
    const lineHeight = 3.95;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(size);

    const lines = doc.splitTextToSize(value, contentWidth - indent);
    const needed = lines.length * lineHeight + 0.55;

    ensureSpace(needed + 1.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(45, 45, 45);
    doc.text("-", margin, y);
    doc.text(lines, margin + indent, y);

    y += needed;
  };

  const writeCompactText = (textValue, options = {}) => {
    const value = normalize(textValue);
    if (!value) return;

    const size = options.size ?? 8.6;
    const lineHeight = options.lineHeight ?? 3.95;
    const after = options.after ?? 0.8;
    const bold = Boolean(options.bold);
    const width = options.width ?? contentWidth;
    const x = options.x ?? margin;
    const color = options.color ?? [42, 42, 42];

    const lineCount = estimateLines(value, width, size);
    ensureSpace(lineCount * lineHeight + after + 1);

    doc.setFont("Helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(value, width);
    doc.text(lines, x, y);
    y += lines.length * lineHeight + after;
  };

  // Summary
  if (model.summary) {
    sectionTitle("Summary", 15);
    writeCompactText(model.summary, {
      size: 8.75,
      lineHeight: 3.95,
      after: 1.0,
    });
  }

  // Skills
  if (model.skills?.length) {
    const skillHeight = model.skills.reduce(
      (sum, group) => {
        const line = `${group.category}: ${(group.skills || []).join(", ")}`;
        return (
          sum +
          Math.max(1, estimateLines(line, contentWidth, 8.45)) * 3.85 +
          0.5
        );
      },
      0,
    );

    sectionTitle("Skills", skillHeight + 1);

    model.skills.forEach((group) => {
      const skills = (group.skills || []).join(", ");
      if (!skills) return;

      writeCompactText(`${group.category}: ${skills}`, {
        size: 8.45,
        lineHeight: 3.85,
        after: 0.45,
      });
    });

    y += 0.5;
  }

  // Experience
  if (model.experience?.length) {
    sectionTitle("Experience", 10);

    model.experience.forEach((entry) => {
      const heading = [entry.title, entry.company, entry.dates]
        .filter(Boolean)
        .join(" | ");

      if (heading) {
        writeCompactText(heading, {
          size: 8.8,
          lineHeight: 3.95,
          bold: true,
          after: 0.35,
        });
      }

      (entry.bullets || []).forEach((bulletText) => {
        writeBullet(bulletText);
      });

      y += 0.45;
    });
  }

  // Projects
  if (model.projects?.length) {
    sectionTitle("Projects", 14);

    model.projects.forEach((project) => {
      const heading = [project.name, project.dates]
        .filter(Boolean)
        .join(" | ");

      if (heading) {
        const lines = (() => {
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8.8);
          return doc.splitTextToSize(heading, contentWidth);
        })();

        ensureSpace(lines.length * 3.95 + 2);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.8);
        doc.setTextColor(24, 24, 24);
        doc.text(lines, margin, y);
        y += lines.length * 3.95 + 0.25;
      }

      if (project.technologies?.length) {
        writeCompactText(
          `Technologies: ${project.technologies.join(", ")}`,
          {
            size: 8.1,
            lineHeight: 3.7,
            color: [88, 88, 88],
            after: 0.35,
          },
        );
      }

      (project.bullets || []).forEach((bulletText) => {
        writeBullet(bulletText);
      });

      y += 0.4;
    });
  }

  // Education
  if (model.education?.length) {
    sectionTitle("Education", 12);

    model.education.forEach((entry) => {
      const heading = [entry.degree, entry.institution, entry.dates]
        .filter(Boolean)
        .join(" | ");

      if (heading) {
        writeCompactText(heading, {
          size: 8.75,
          lineHeight: 3.9,
          bold: true,
          after: 0.3,
        });
      }

      (entry.details || []).forEach((detail) => {
        writeCompactText(detail, {
          size: 8.2,
          lineHeight: 3.7,
          x: margin + 2,
          width: contentWidth - 2,
          color: [65, 65, 65],
          after: 0.25,
        });
      });

      y += 0.45;
    });
  }

  // Certifications
  if (model.certifications?.length) {
    const certEstimate = model.certifications.reduce(
      (sum, item) =>
        sum +
        Math.max(1, estimateLines(item, contentWidth - 4.2, 8.35)) * 3.8 +
        0.5,
      0,
    );

    const totalCertNeeded = 7 + certEstimate;

    if (y + totalCertNeeded > bottomLimit && y < bottomLimit - 20) {
      startNewPage();
    }

    sectionTitle("Certifications", certEstimate + 1);
    model.certifications.forEach((item) => writeBullet(item));
  }

  // RESUMEAI_PDF_COMPACT_STRENGTHS_V1
  // Keep this low-priority, source-provided section compact so it cannot become
  // a nearly empty second page by itself. The preview still shows the full section.
  if (model.key_strengths?.length) {
    const strengthText = model.key_strengths
      .map((item) => normalize(item))
      .filter(Boolean)
      .join("; ");
    if (strengthText) {
      writeCompactText(`Key strengths: ${strengthText}`, {
        size: 7.7,
        lineHeight: 3.25,
        after: 0.25,
        color: [65, 65, 65],
      });
    }
  }

  // Achievements
  if (model.achievements?.length) {
    sectionTitle("Achievements", 10);
    model.achievements.forEach((item) => writeBullet(item));
  }

  // No product branding/footer is added to the candidate's resume PDF.

  const safeRole = String(targetRole || "tailored-resume")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  doc.save(
    `ResumeAI-${safeRole || "tailored-resume"}.pdf`,
  );
}
