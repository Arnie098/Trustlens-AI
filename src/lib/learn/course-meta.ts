/**
 * Course catalog metadata for the Learn UI.
 * Lesson bodies live in the DB (seeded from scripts/learning-materials.json).
 */
export interface CourseMeta {
  slug: string;
  code: string;
  tagline: string;
  outcomes: string[];
  skills: string[];
  audience: string;
  certificateHint: string;
}

export const COURSE_META: Record<string, CourseMeta> = {
  "spot-misleading-headlines": {
    slug: "spot-misleading-headlines",
    code: "ML-101",
    tagline: "Decode clickbait, missing context, and emotional framing in under an hour.",
    outcomes: [
      "Identify emotional and absolute language in headlines",
      "Separate a headline claim from article evidence",
      "Apply a 60-second verification checklist before sharing",
    ],
    skills: ["Media literacy", "Critical reading", "Claim isolation"],
    audience: "Beginners and everyday news readers",
    certificateHint: "Complete all sections and pass the quiz at 70%+",
  },
  "verify-images-videos": {
    slug: "verify-images-videos",
    code: "VF-201",
    tagline: "Trace photos and clips to their original context with practical techniques.",
    outcomes: [
      "Run reverse image search and interpret results",
      "Spot out-of-context reuse of real media",
      "Recognize common deepfake and edit signals without over-trusting detectors",
    ],
    skills: ["Visual verification", "Provenance", "OSINT basics"],
    audience: "Intermediate learners who share or moderate media",
    certificateHint: "Finish the curriculum and pass the practical quiz",
  },
  "understanding-ai-content": {
    slug: "understanding-ai-content",
    code: "AI-210",
    tagline: "Understand how generative AI is used—and misused—online.",
    outcomes: [
      "Describe where AI-generated content commonly appears",
      "List imperfect text and image signals worth checking",
      "Use AI analysis tools as assistants, not authorities",
    ],
    skills: ["AI literacy", "Skepticism", "Responsible tooling"],
    audience: "Anyone who reads social feeds or uses AI tools",
    certificateHint: "Complete lessons + quiz to unlock Critical Thinker progress",
  },
  "source-credibility": {
    slug: "source-credibility",
    code: "SC-120",
    tagline: "Judge publishers, authors, and evidence trails like a careful researcher.",
    outcomes: [
      "Evaluate outlet transparency (bylines, corrections, ownership)",
      "Follow citations to primary documents",
      "Compare framing across independent sources",
    ],
    skills: ["Source evaluation", "Evidence trails", "Bias awareness"],
    audience: "Students, journalists-in-training, and civic readers",
    certificateHint: "Pass the quiz after finishing all modules",
  },
  "think-before-sharing": {
    slug: "think-before-sharing",
    code: "BH-105",
    tagline: "Build pause habits that stop misinformation at the share button.",
    outcomes: [
      "Explain why speed and emotion amplify falsehoods",
      "Use a five-question pause routine before resharing",
      "Correct mistakes in a way that reduces further harm",
    ],
    skills: ["Behavioral habits", "Community norms", "Digital citizenship"],
    audience: "Everyone who posts or forwards content",
    certificateHint: "Complete the course and quiz to practice safer sharing",
  },
};

export function getCourseMeta(slug: string): CourseMeta | null {
  return COURSE_META[slug] ?? null;
}
