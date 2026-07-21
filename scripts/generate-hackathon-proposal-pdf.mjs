/**
 * UNESCO Youth Hackathon 2026 proposal PDF
 * Preserves original layout/structure; only light Android mobile feature additions.
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(
  __dirname,
  "..",
  "Philippines_UNESCO Youth Hackathon 2026.pdf",
);

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  info: {
    Title: "UNESCO Youth Hackathon 2026 — TrustLens AI Project Proposal",
    Author: "Team TrustLens (Philippines)",
  },
});

const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

const black = "#000000";
const pageInnerW = () =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

function ensureSpace(h = 72) {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function titleCentered(text, size = 14) {
  doc
    .font("Times-Bold")
    .fontSize(size)
    .fillColor(black)
    .text(text, { align: "center", width: pageInnerW() });
}

function metaLine(text) {
  doc.font("Times-Roman").fontSize(11).fillColor(black).text(text, {
    width: pageInnerW(),
    align: "left",
  });
}

function h1(text) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(black)
    .text(text, { width: pageInnerW() });
  doc.moveDown(0.35);
}

function h2(text) {
  ensureSpace(28);
  doc.moveDown(0.25);
  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor(black)
    .text(text, { width: pageInnerW() });
  doc.moveDown(0.25);
}

function p(text) {
  ensureSpace(36);
  doc
    .font("Times-Roman")
    .fontSize(11)
    .fillColor(black)
    .text(text, { width: pageInnerW(), align: "justify", lineGap: 2.5 });
  doc.moveDown(0.45);
}

function pBoldLead(boldPart, rest) {
  ensureSpace(36);
  doc
    .font("Times-Bold")
    .fontSize(11)
    .fillColor(black)
    .text(boldPart, { continued: true, width: pageInnerW(), align: "justify", lineGap: 2.5 });
  doc
    .font("Times-Roman")
    .text(rest, { width: pageInnerW(), align: "justify", lineGap: 2.5 });
  doc.moveDown(0.45);
}

function bullet(text) {
  ensureSpace(22);
  doc
    .font("Times-Roman")
    .fontSize(11)
    .fillColor(black)
    .text(`\u2022  ${text}`, {
      width: pageInnerW(),
      indent: 12,
      lineGap: 1.5,
    });
  doc.moveDown(0.12);
}

function numbered(n, text) {
  ensureSpace(22);
  doc
    .font("Times-Roman")
    .fontSize(11)
    .fillColor(black)
    .text(`${n}.  ${text}`, { width: pageInnerW(), lineGap: 1.5 });
  doc.moveDown(0.12);
}

function table(headers, rows, colWeights) {
  ensureSpace(50);
  const totalW = pageInnerW();
  const sum = colWeights.reduce((a, b) => a + b, 0);
  const widths = colWeights.map((w) => (w / sum) * totalW);
  const startX = doc.page.margins.left;
  const pad = 5;
  const fontSize = 10;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  function rowHeight(cells, header) {
    return (
      Math.max(
        ...cells.map((c, i) => {
          doc.font(header ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
          return doc.heightOfString(String(c), {
            width: widths[i] - pad * 2,
          });
        }),
      ) +
      pad * 2
    );
  }

  function drawRow(cells, header) {
    const h = rowHeight(cells, header);
    if (doc.y + h > bottom()) doc.addPage();
    const y0 = doc.y;
    let x = startX;
    cells.forEach((_, i) => {
      doc.rect(x, y0, widths[i], h).stroke(black);
      x += widths[i];
    });
    x = startX;
    cells.forEach((c, i) => {
      doc
        .font(header ? "Times-Bold" : "Times-Roman")
        .fontSize(fontSize)
        .fillColor(black)
        .text(String(c), x + pad, y0 + pad, {
          width: widths[i] - pad * 2,
          lineGap: 1,
        });
      x += widths[i];
    });
    doc.y = y0 + h;
  }

  drawRow(headers, true);
  for (const r of rows) drawRow(r, false);
  doc.moveDown(0.5);
}

// ——— Title (original layout) ———
titleCentered("UNESCO Youth Hackathon 2026", 14);
doc.moveDown(0.85);
metaLine("Project Proposal");
metaLine("TrustLens AI: Think Before You Trust");
metaLine("Team Name: TrustLens");
metaLine("Category: Applications / Websites");
metaLine("Country: Philippines");
doc.moveDown(0.55);

// ——— 1. Executive Summary ———
h1("1. Executive Summary");

p(
  "Imagine a world where every image, video, or news story you see online could be artificially generated, manipulated, or completely fabricated, yet almost impossible to distinguish from reality. As generative Artificial Intelligence (AI) rapidly reshapes the digital landscape, misinformation now spreads faster, farther, and more convincingly than ever before. Deepfakes, AI-generated images, fabricated videos, and hallucinated AI responses have become emerging global threats that undermine public trust, informed decision-making, and democratic participation (UNESCO, 2023; World Economic Forum, 2025). While AI has revolutionized access to information, it has also created an urgent need to strengthen Media and Information Literacy (MIL) and equip young people with the critical thinking skills necessary to navigate an increasingly complex information ecosystem (Walter et al., 2020).",
);

pBoldLead(
  "TrustLens AI: Think Before You Trust ",
  "is an AI-powered web and mobile platform that transforms Media and Information Literacy into an interactive, real-time experience. Rather than functioning as a conventional fact-checking application, TrustLens AI empowers users to understand why information can be trusted through explainable AI, transparent Trust Scores, source verification, AI-generated content detection, and contextual analysis. By combining artificial intelligence with behavioral science and education, the platform encourages users to verify information before believing or sharing it, fostering lifelong habits of critical thinking and responsible digital engagement.",
);

// MOD: original had two signature innovations; keep them and lightly extend with Android assist
p(
  "The platform introduces two signature innovations that distinguish it from existing solutions. Pause Before Sharing encourages users to stop and review evidence before reposting questionable content, while Trust Replay visually traces how misinformation spreads across digital platforms, helping users understand its origins, amplification, and societal impact. On Android, TrustLens also provides a native mobile app (Capacitor) with camera and text scanning, share/clipboard verification, and an optional Floating Verify Assist bubble so users can check posts while scrolling social media—always by user action, never by silent surveillance. Complemented by gamified learning modules, achievement badges, and community-driven challenges, TrustLens AI transforms digital verification into an engaging educational journey that empowers youth to become active defenders of truthful and responsible information.",
);

p(
  "More than a technology solution, TrustLens AI is a movement to rebuild digital trust. By empowering young people with the knowledge, skills, and confidence to critically evaluate information in the age of AI, the platform seeks to cultivate a generation of informed, ethical, and digitally resilient citizens capable of strengthening democratic participation, promoting responsible AI use, and creating a safer, more trustworthy digital future.",
);

// ——— 2. TECHNICAL ARCHITECTURE ———
h1("2. TECHNICAL ARCHITECTURE");

h2("Core Components");
table(
  ["Component", "Purpose"],
  [
    [
      "TrustLens AI Engine",
      "Performs AI-powered credibility assessment and content analysis.",
    ],
    [
      "Trust Score Analyzer",
      "Calculates content reliability using source credibility, contextual analysis, and AI-generated content detection.",
    ],
    [
      "Explainable AI Module",
      "Generates transparent explanations showing why content is trustworthy or misleading.",
    ],
    [
      "Trust Replay Engine",
      "Visualizes how misinformation spreads across digital platforms through interactive timelines.",
    ],
    [
      "Pause Before Sharing Module",
      "Encourages users to verify suspicious content before reposting through behavioral nudges.",
    ],
    [
      "Learning Management Module",
      "Delivers interactive Media and Information Literacy (MIL) lessons, quizzes, badges, and progress tracking.",
    ],
    // MOD: Android additions (minimal new rows)
    [
      "Android Mobile App (Capacitor)",
      "Packages the TrustLens web experience as a native Android app with camera, share, and clipboard access.",
    ],
    [
      "Camera & Text Scanner (OCR)",
      "Lets users photograph or import a post and extract caption text on-device for review before analysis.",
    ],
    [
      "Floating Verify Assist (Android)",
      "Optional, lightweight overlay bubble for in-feed verification actions; default off; designed not to lag or distract.",
    ],
    [
      "Administration Dashboard",
      "Manages users, educational content, analytics, moderation, and AI governance.",
    ],
  ],
  [1.2, 2.5],
);

h2("Supporting Technologies");
table(
  ["Layer", "Technology"],
  [
    ["Frontend", "React 19 + TypeScript + Tailwind CSS"],
    ["Backend", "Node.js + Express.js"],
    ["Database", "PostgreSQL"],
    ["Authentication", "Firebase Authentication / OAuth 2.0"],
    ["AI Engine", "OpenAI GPT-4.1 / DeepSeek Chat (Model Agnostic)"],
    ["AI Content Detection", "Hive Moderation API / OpenAI Moderation API"],
    ["Cloud Storage", "Firebase Storage"],
    ["Hosting", "Vercel + Supabase"],
    ["Analytics", "Google Analytics 4"],
    // MOD
    [
      "Android Mobile",
      "Capacitor shell; Camera, Clipboard, Share plugins; optional native floating assist",
    ],
  ],
  [1.15, 2.55],
);

h2("System Workflow");
numbered(1, "User registers and creates a secure account.");
numbered(
  2,
  "User pastes a URL, uploads an image, or submits text for verification. On Android, the user may also share a post into TrustLens, verify the clipboard, import a screenshot, or scan content with the camera.",
);
numbered(
  3,
  "The AI Engine analyzes the content using source verification, contextual analysis, and AI-generated content detection.",
);
numbered(
  4,
  "TrustLens generates a transparent Trust Score with explainable reasoning.",
);
numbered(
  5,
  "If content is potentially misleading, the Pause Before Sharing feature prompts users to review evidence before reposting.",
);
numbered(
  6,
  "Users explore Trust Replay to understand how misinformation spreads.",
);
numbered(
  7,
  "Learning modules recommend relevant Media and Information Literacy lessons based on verification results.",
);
numbered(
  8,
  "Administrators monitor analytics, educational engagement, and system performance through the governance dashboard.",
);
// MOD: one extra step for floating assist (optional path)
numbered(
  9,
  "(Android, optional) User enables Floating Verify Assist; while using social apps, the user taps the bubble to scan, import a screenshot, or verify clipboard content—without the app reading their feed automatically.",
);
doc.moveDown(0.35);

// ——— 3. AI APPROACH ———
h1("3. AI APPROACH & MODEL SELECTION");

p(
  "TrustLens AI employs an Explainable Retrieval-Augmented Prompting (ERAP) approach that combines prompt engineering, source verification, explainable artificial intelligence, and behavioral interventions instead of relying solely on conventional AI-generated classifications.",
);

h2("AI Features");
numbered(
  1,
  'Trust Score Assessment — Evaluates the credibility of online content using multiple verification indicators.',
);
numbered(
  2,
  'Explainable AI — Provides human-readable explanations rather than binary "true" or "false" decisions.',
);
numbered(
  3,
  "AI-Generated Content Detection — Identifies AI-generated text and images through external detection services.",
);
numbered(
  4,
  "Trust Replay — Visualizes the propagation of misinformation across digital platforms.",
);
numbered(
  5,
  "Personalized Learning Recommendations — Suggests MIL lessons based on users' verification history.",
);
// MOD
numbered(
  6,
  "Mobile multimodal intake (Android) — Accepts camera captures, OCR text, screenshots, shared links/images, and clipboard text into the same explainable analysis pipeline.",
);
doc.moveDown(0.3);

h2("Key Design Decisions");
table(
  ["Design Choice", "Rationale"],
  [
    [
      "Explainable AI",
      "Builds transparency and user trust by explaining every assessment.",
    ],
    [
      "Multi-factor Trust Score",
      "Avoids oversimplified true-or-false classifications.",
    ],
    [
      "Behavioral Nudging",
      "Encourages responsible online behavior before sharing content.",
    ],
    [
      "Human-Centered AI",
      "Supports critical thinking rather than replacing user judgment.",
    ],
    [
      "Model-Agnostic Architecture",
      "Allows seamless switching between OpenAI, DeepSeek, Gemini, or future AI providers.",
    ],
    // MOD
    [
      "User-initiated Android capture",
      "Respects privacy: scan, share, clipboard, or screenshot only when the user chooses—no silent feed scraping.",
    ],
  ],
  [1.25, 2.45],
);

h2("AI Techniques");
bullet("Prompt engineering with structured verification prompts");
bullet("Explainable AI (XAI)");
bullet("Source credibility verification");
bullet("Context-aware reasoning");
bullet("Reverse image search integration");
bullet("AI-generated content detection");
bullet("Behavioral intervention prompts");
bullet("Educational recommendation engine");
// MOD
bullet("On-device OCR for Android text extraction from still images");
doc.moveDown(0.35);

h2("Selected Model");
doc.font("Times-Bold").fontSize(11).text("Primary Model: ", { continued: true });
doc.font("Times-Roman").text("OpenAI GPT-4.1");
doc.font("Times-Bold").fontSize(11).text("Alternative Model: ", { continued: true });
doc.font("Times-Roman").text("DeepSeek Chat");
doc.moveDown(0.35);

h2("Reason for Selection");
bullet("Strong reasoning capability");
bullet("Excellent natural language understanding");
bullet("Explainable responses");
bullet("API scalability");
bullet("Cost-effective deployment");
bullet("Provider-independent architecture");
doc.moveDown(0.35);

// ——— SECTION 4 ———
h1("SECTION 4: DATA STRATEGY & ETHICS");

h2("Data Collected");
p(
  "TrustLens AI collects only information necessary to provide verification and educational services.",
);
bullet("User profile information");
bullet("Submitted URLs");
bullet("Uploaded images");
// MOD
bullet("Camera captures, screenshots, and OCR-extracted text submitted from the Android app");
bullet("Verification requests");
bullet("Learning progress");
bullet("Quiz scores");
bullet("Badge achievements");
bullet("Anonymous analytics");
bullet("User consent records");
// MOD
bullet("Floating assist preference (enabled/hidden) on Android devices");
doc.moveDown(0.3);

h2("Data Protection Measures");
table(
  ["Principle", "Implementation"],
  [
    [
      "Data Minimization",
      "Only content submitted for verification is processed.",
    ],
    ["User Consent", "AI features require explicit user agreement."],
    [
      "Encryption",
      "HTTPS and encrypted cloud storage protect user data.",
    ],
    [
      "Transparency",
      "Explainable AI reveals how verification decisions are generated.",
    ],
    [
      "Privacy",
      "Personal information is never shared with third parties without consent.",
    ],
    // MOD
    [
      "Android overlay",
      "Floating assist is optional; it does not read social feeds by itself.",
    ],
  ],
  [1.15, 2.55],
);

h2("Ethical Principles");
p("TrustLens AI follows internationally recognized AI ethics principles:");
bullet("Transparency");
bullet("Fairness");
bullet("Accountability");
bullet("Privacy");
bullet("Inclusiveness");
bullet("Human oversight");
bullet("Responsible AI");
bullet("Media and Information Literacy");
doc.moveDown(0.3);

h2("Bias Mitigation");
p("Potential risks include:");
bullet("AI hallucinations");
bullet("Political bias");
bullet("Cultural bias");
bullet("Language limitations");
doc.moveDown(0.2);
p("Mitigation strategies include:");
bullet("Multi-source verification");
bullet("Confidence indicators");
bullet("Human review mechanisms");
bullet("Continuous model evaluation");
bullet("Explainable AI outputs");
bullet("Regular bias monitoring");
doc.moveDown(0.3);

h2("Data Lifecycle");
numbered(1, "User submits digital content (web form or Android capture/share/clipboard).");
numbered(2, "User grants explicit consent for AI processing.");
numbered(3, "AI analyzes content and generates a Trust Score.");
numbered(4, "Verification results and explanations are displayed.");
numbered(5, "Learning recommendations are generated.");
numbered(6, "Anonymous analytics are stored securely.");
numbered(7, "Users may delete their data or withdraw consent at any time.");
doc.moveDown(0.35);

// ——— SECTION 5 ———
h1("SECTION 5: DEVELOPMENT MILESTONES (AGILE ROADMAP)");

table(
  ["Sprint", "Major Deliverables"],
  [
    [
      "Sprint 1",
      "User authentication, onboarding, Trust Score prototype, database setup, UI/UX design",
    ],
    [
      "Sprint 2",
      "AI verification engine, Explainable AI module, source verification integration",
    ],
    [
      "Sprint 3",
      "Trust Replay visualization, Pause Before Sharing, learning modules",
    ],
    ["Sprint 4", "Gamification, quizzes, badges, analytics dashboard"],
    [
      "Sprint 5",
      "Testing, security, accessibility improvements, deployment",
    ],
    // MOD: one extra sprint for Android (minimal extension)
    [
      "Sprint 6",
      "Android Capacitor app: camera/OCR scanner, share & clipboard verify, Floating Verify Assist, performance QA",
    ],
  ],
  [0.7, 3.0],
);

h2("Final Prototype Outcomes");
bullet("Responsive web application");
// MOD: replace vague mobile-ready with concrete Android outcomes
bullet("Android mobile application (Capacitor) with core verification and learning features");
bullet("Camera / OCR scan, screenshot import, share sheet, and clipboard verification");
bullet("Optional Floating Verify Assist (calm, opt-in, low performance impact)");
bullet("AI-powered Trust Score system");
bullet("Explainable AI verification");
bullet("Trust Replay visualization");
bullet("Pause Before Sharing behavioral intervention");
bullet("Interactive Media and Information Literacy lessons");
bullet("Gamification system");
bullet("Analytics dashboard");
bullet("Administrator governance portal");
doc.moveDown(0.35);

// ——— SECTION 6 ———
h1("SECTION 6: SCALABILITY & REGIONAL RESILIENCE");

h2("Scaling Potential");
p("TrustLens AI is designed for global deployment through:");
numbered(1, "Cloud-native architecture supporting millions of users.");
numbered(2, "Modular AI services enabling future model replacement.");
numbered(3, "Multi-language support for international expansion.");
numbered(4, "School and university integration.");
numbered(5, "API interoperability with fact-checking organizations.");
numbered(6, "Containerized deployment using Docker and Kubernetes.");
numbered(7, "Regional hosting for data sovereignty compliance.");
numbered(
  8,
  "Mobile-first architecture optimized for low-bandwidth environments, including a lightweight Android app for mid-range phones.",
);
doc.moveDown(0.3);

h2("Technical Constraints & Mitigation");
table(
  ["Constraint", "Mitigation"],
  [
    [
      "AI hallucinations",
      "Multi-source verification and explainable AI outputs",
    ],
    [
      "External AI dependency",
      "Model-agnostic architecture supporting multiple providers",
    ],
    [
      "API latency",
      "Asynchronous processing with background queues",
    ],
    [
      "Language limitations",
      "Multilingual prompt engineering and localization",
    ],
    [
      "Emerging misinformation patterns",
      "Continuous AI model updates and human moderation",
    ],
    [
      "Privacy regulations",
      "Compliance with GDPR and regional data protection standards",
    ],
    [
      "Scalability challenges",
      "Cloud auto-scaling and distributed infrastructure",
    ],
    [
      "User trust",
      "Transparent explanations and confidence scoring",
    ],
    // MOD
    [
      "Android lag / distraction",
      "Idle floating assist uses near-zero CPU; default off; half-hide; no auto pop-ups",
    ],
  ],
  [1.2, 2.5],
);

// ——— References ———
h1("References:");
p(
  "UNESCO. (2023). Guidance for generative AI in education and research. UNESCO. https://unesdoc.unesco.org/ark:/48223/pf0000386693",
);
p(
  "Walter, N., Cohen, J., Holbert, R. L., & Morag, Y. (2020). Fact-checking: A meta-analysis of what works and for whom. Political Communication, 37(3), 350–375. https://doi.org/10.1080/10584609.2019.1668894",
);
p(
  "World Economic Forum. (2025). The Global Risks Report 2025 (20th ed.). World Economic Forum.",
);

doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log("Wrote", outPath);
