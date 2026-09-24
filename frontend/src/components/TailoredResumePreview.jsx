import jsPDF from "jspdf";
import "./TailoredResumePreview.css";

const SECTION_ORDER = ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS"];
const normalize = (value) => String(value ?? "").trim();

export function parseTailoredResume(value) {
  if (!value) return null;
  if (typeof value === "object" && value.format_version === 1) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && parsed.format_version === 1) return parsed;
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
  if (model.achievements?.length) { lines.push("", "ACHIEVEMENTS"); model.achievements.forEach((item) => lines.push("- " + item)); }
  return lines.join("\n").trim();
}

const renderEntries = (items, kind) => items.map((entry, index) => {
  const title = kind === "project" ? entry.name : entry.title;
  const meta = kind === "project" ? [entry.dates].filter(Boolean).join(" • ") : [entry.company, entry.dates].filter(Boolean).join(" • ");
  return <div className="tailored-resume-entry" key={(title || "entry") + "-" + index}>
    <div className="tailored-resume-entry-top"><strong>{title || "Untitled"}</strong>{meta && <span>{meta}</span>}</div>
    {kind === "project" && entry.technologies?.length > 0 && <div className="tailored-resume-tech"><span>Technologies</span><span>{entry.technologies.join(" • ")}</span></div>}
    {kind === "education" && entry.details?.map((detail, detailIndex) => <div className="tailored-resume-detail" key={detail + "-" + detailIndex}>{detail}</div>)}
    {!!entry.bullets?.length && <ul className="tailored-resume-bullets">{entry.bullets.map((bullet, bulletIndex) => <li key={bullet + "-" + bulletIndex}>{bullet}</li>)}</ul>}
  </div>;
});

function Section({ title, children }) { return <section className="tailored-resume-section"><h4>{title}</h4><div>{children}</div></section>; }

export default function TailoredResumePreview({ value, targetRole }) {
  const model = parseTailoredResume(value) || parseLegacyResume(value);
  if (!model) return <div className="tailored-resume-empty"><p>No tailored resume is available yet.</p></div>;
  const contactLine = [...(model.contact_items || []), ...(model.links || [])].map(normalize).filter(Boolean).join(" • ");
  return <div className="tailored-resume-preview-wrap"><article className="tailored-resume-paper">
    <header className="tailored-resume-header">
      <h2>{model.name || "Tailored Resume"}</h2>
      {model.headline ? <p className="tailored-resume-headline">{model.headline}</p> : targetRole && <p className="tailored-resume-headline">Tailored for {targetRole}</p>}
      {contactLine && <p className="tailored-resume-contact">{contactLine}</p>}
      {model.location && <p className="tailored-resume-location">{model.location}</p>}
    </header>
    {model.summary && <Section title="Summary"><p className="tailored-resume-summary">{model.summary}</p></Section>}
    {!!model.skills?.length && <Section title="Skills"><div className="tailored-resume-skills">{model.skills.map((group, index) => <div className="tailored-resume-skill-row" key={(group.category || "skills") + "-" + index}><strong>{group.category}</strong><span>{(group.skills || []).join(" • ")}</span></div>)}</div></Section>}
    {!!model.experience?.length && <Section title="Experience">{renderEntries(model.experience, "experience")}</Section>}
    {!!model.projects?.length && <Section title="Projects">{renderEntries(model.projects, "project")}</Section>}
    {!!model.education?.length && <Section title="Education">{renderEntries(model.education, "education")}</Section>}
    {!!model.certifications?.length && <Section title="Certifications"><ul className="tailored-resume-simple-list">{model.certifications.map((item, index) => <li key={item + "-" + index}>{item}</li>)}</ul></Section>}
    {!!model.achievements?.length && <Section title="Achievements"><ul className="tailored-resume-simple-list">{model.achievements.map((item, index) => <li key={item + "-" + index}>{item}</li>)}</ul></Section>}
  </article></div>;
}

function addPdfText(doc, text, x, y, width, options = {}) {
  const { size = 9.6, bold = false, lineHeight = 4.7, color = [32, 32, 32], after = 1.2 } = options;
  const value = normalize(text); if (!value) return y;
  doc.setFont("Helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
  const lines = doc.splitTextToSize(value, width); if (!lines.length) return y;
  doc.text(lines, x, y); return y + lines.length * lineHeight + after;
}
function ensurePdfSpace(doc, y, needed = 12) { if (y + needed <= 279) return y; doc.addPage(); return 18; }

export function downloadTailoredResumePdf(value, targetRole = "Tailored Resume") {
  const model = parseTailoredResume(value) || parseLegacyResume(value); if (!model) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const margin = 18; const contentWidth = 210 - margin * 2; let y = 20;
  doc.setProperties({ title: model.name ? model.name + " — Resume" : "ResumeAI Tailored Resume", subject: targetRole });
  doc.setFont("Helvetica", "bold"); doc.setFontSize(21); doc.setTextColor(24,24,24); doc.text(model.name || "Tailored Resume", margin, y); y += 7;
  const headline = model.headline || (targetRole ? "Tailored for " + targetRole : ""); if (headline) y = addPdfText(doc, headline, margin, y, contentWidth, {size:10.5,color:[92,92,92],after:2});
  const contacts = [...(model.contact_items || []), ...(model.links || [])].map(normalize).filter(Boolean); if (contacts.length) y = addPdfText(doc, contacts.join(" • "), margin, y, contentWidth, {size:8.7,color:[86,86,86],after:1});
  if (model.location) y = addPdfText(doc, model.location, margin, y, contentWidth, {size:8.7,color:[86,86,86],after:2});
  doc.setDrawColor(245,158,11); doc.setLineWidth(0.7); doc.line(margin,y,210-margin,y); y += 8;
  const sectionTitle = (title) => { y=ensurePdfSpace(doc,y,12); doc.setFont("Helvetica","bold"); doc.setFontSize(11); doc.setTextColor(24,24,24); doc.text(title.toUpperCase(),margin,y); y+=5.5; doc.setDrawColor(225,225,225); doc.setLineWidth(0.25); doc.line(margin,y-2,210-margin,y-2); y+=1.5; };
  const bullet = (textValue) => { y=ensurePdfSpace(doc,y,8); const value=normalize(textValue); if(!value)return; doc.setFont("Helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(42,42,42); const lines=doc.splitTextToSize(value,contentWidth-6); if(!lines.length)return; doc.text("•",margin,y); doc.text(lines,margin+4.5,y); y+=lines.length*4.6+1.2; };
  if(model.summary){sectionTitle("Summary");y=addPdfText(doc,model.summary,margin,y,contentWidth,{size:9.6,color:[42,42,42],after:2});}
  if(model.skills?.length){sectionTitle("Skills");model.skills.forEach((group)=>{y=addPdfText(doc,group.category+": "+(group.skills||[]).join(", "),margin,y,contentWidth,{size:9.3,after:1.5});});y+=1;}
  if(model.experience?.length){sectionTitle("Experience");model.experience.forEach((entry)=>{y=ensurePdfSpace(doc,y,10);y=addPdfText(doc,[entry.title,entry.company,entry.dates].filter(Boolean).join(" | "),margin,y,contentWidth,{size:9.8,bold:true,after:1});(entry.bullets||[]).forEach(bullet);y+=1;});}
  if(model.projects?.length){sectionTitle("Projects");model.projects.forEach((project)=>{y=ensurePdfSpace(doc,y,10);y=addPdfText(doc,[project.name,project.dates].filter(Boolean).join(" | "),margin,y,contentWidth,{size:9.8,bold:true,after:0.8});if(project.technologies?.length)y=addPdfText(doc,"Technologies: "+project.technologies.join(", "),margin,y,contentWidth,{size:8.9,color:[88,88,88],after:1});(project.bullets||[]).forEach(bullet);y+=1;});}
  if(model.education?.length){sectionTitle("Education");model.education.forEach((entry)=>{y=addPdfText(doc,[entry.degree,entry.institution,entry.dates].filter(Boolean).join(" | "),margin,y,contentWidth,{size:9.8,bold:true,after:1});(entry.details||[]).forEach((detail)=>{y=addPdfText(doc,detail,margin+3,y,contentWidth-3,{size:9.1,color:[66,66,66],after:0.8});});y+=1;});}
  if(model.certifications?.length){sectionTitle("Certifications");model.certifications.forEach(bullet);y+=1;}
  if(model.achievements?.length){sectionTitle("Achievements");model.achievements.forEach(bullet);}
  const totalPages=doc.getNumberOfPages(); for(let page=1;page<=totalPages;page+=1){doc.setPage(page);doc.setFont("Helvetica","normal");doc.setFontSize(7.8);doc.setTextColor(130,130,130);doc.text("ResumeAI • "+(targetRole||"Tailored Resume")+" • Page "+page+" of "+totalPages,margin,287);}
  const safeRole=String(targetRole||"tailored-resume").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,""); doc.save("ResumeAI-"+(safeRole||"tailored-resume")+".pdf");
}
