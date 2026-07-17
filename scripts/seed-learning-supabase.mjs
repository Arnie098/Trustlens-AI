/**
 * Push rich learning materials to Supabase via PostgREST (service role).
 * Usage: node scripts/seed-learning-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const materials = JSON.parse(
  readFileSync(resolve("scripts/learning-materials.json"), "utf8"),
);

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function api(path, opts = {}) {
  const r = await fetch(url + path, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b;
  try {
    b = JSON.parse(t);
  } catch {
    b = t;
  }
  if (!r.ok) {
    throw new Error(`${path} ${r.status} ${JSON.stringify(b).slice(0, 300)}`);
  }
  return b;
}

const modules = await api("/rest/v1/learning_modules?select=id,slug&order=sort_order");
console.log("modules:", modules.map((m) => m.slug).join(", "));

// Clear lessons
await fetch(url + "/rest/v1/lessons?id=not.is.null", { method: "DELETE", headers });
console.log("cleared lessons");

const lessonRows = [];
for (const m of modules) {
  const pack = materials[m.slug];
  if (!pack) continue;
  pack.lessons.forEach((l, idx) => {
    lessonRows.push({
      module_id: m.id,
      title: l.title,
      body: l.body,
      sort_order: idx + 1,
    });
  });
  // Sync course catalog fields from materials
  await api(`/rest/v1/learning_modules?id=eq.${m.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: pack.title ?? m.title,
      description: pack.description,
      category: pack.category,
      difficulty: pack.difficulty,
      estimated_minutes: pack.estimated_minutes ?? 45,
    }),
    headers: { ...headers, Prefer: "return=minimal" },
  });
}

const lessons = await api("/rest/v1/lessons", {
  method: "POST",
  body: JSON.stringify(lessonRows),
});
console.log("inserted lessons:", Array.isArray(lessons) ? lessons.length : lessons);

const quizzes = await api("/rest/v1/quizzes?select=id,module_id");
const slugByModule = Object.fromEntries(modules.map((m) => [m.id, m.slug]));

for (const q of quizzes) {
  await fetch(url + `/rest/v1/quiz_questions?quiz_id=eq.${q.id}`, {
    method: "DELETE",
    headers,
  });
}
console.log("cleared quiz questions");

const qrows = [];
for (const q of quizzes) {
  const slug = slugByModule[q.module_id];
  const pack = materials[slug];
  if (!pack?.questions) continue;
  pack.questions.forEach((qq, idx) => {
    qrows.push({
      quiz_id: q.id,
      question: qq.question,
      options: qq.options,
      correct_index: qq.correct_index,
      explanation: qq.explanation,
      sort_order: idx + 1,
    });
  });
}

const qins = await api("/rest/v1/quiz_questions", {
  method: "POST",
  body: JSON.stringify(qrows),
});
console.log("inserted questions:", Array.isArray(qins) ? qins.length : qins);

const countL = await api("/rest/v1/lessons?select=id");
const countQ = await api("/rest/v1/quiz_questions?select=id");
console.log("OK — lessons:", countL.length, "questions:", countQ.length);
