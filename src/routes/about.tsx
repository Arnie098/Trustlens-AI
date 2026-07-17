import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Code2,
  Lightbulb,
  Mic2,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import arnieque from "@/assets/team/arnieque-amaba.jpg";
import charles from "@/assets/team/charles-regidor.jpg";
import kathrine from "@/assets/team/kathrine-lim.jpg";
import mark from "@/assets/team/mark-molina.jpg";
import marylen from "@/assets/team/marylen-sabado.jpg";
import nathan from "@/assets/team/nathan-mercado.png";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — TrustLensAI" },
      {
        name: "description",
        content:
          "TrustLensAI is an AI-assisted media literacy platform that helps people evaluate online content before believing or sharing it.",
      },
      { property: "og:title", content: "About TrustLensAI" },
      {
        property: "og:description",
        content: "Our mission, approach, and the team behind TrustLensAI.",
      },
    ],
  }),
  component: About,
});

const TEAM = [
  {
    name: "Nathan Jay Mercado",
    role: "Conceptualizer",
    image: nathan,
    blurb: "Shapes product vision and the media-literacy thesis behind every signal.",
    icon: Lightbulb,
    accent: "from-teal/40 to-navy/30",
  },
  {
    name: "Arnieque Amaba",
    role: "Programmer",
    image: arnieque,
    blurb: "Builds the full-stack core — auth, data, and verification flows.",
    icon: Code2,
    accent: "from-navy/40 to-teal/25",
  },
  {
    name: "Mark Jovin Molina",
    role: "Programmer",
    image: mark,
    blurb: "Implements product features and the end-to-end verify experience.",
    icon: Code2,
    accent: "from-navy/35 to-teal/30",
  },
  {
    name: "Charles Gabriel Regidor",
    role: "Pitcher",
    image: charles,
    blurb: "Owns narrative, demos, and how TrustLens is told to the room.",
    icon: Mic2,
    accent: "from-teal/35 to-accent/40",
  },
  {
    name: "Kathrine Lim",
    role: "Pitcher",
    image: kathrine,
    blurb: "Crafts audience messaging and pitch delivery that lands clearly.",
    icon: Mic2,
    accent: "from-accent/45 to-teal/30",
  },
  {
    name: "Marylen Sabado",
    role: "Video Editor",
    image: marylen,
    blurb: "Produces visual storytelling and motion that carries the brand.",
    icon: Video,
    accent: "from-teal/40 to-navy/25",
  },
] as const;

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in oklab, var(--teal) 18%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, color-mix(in oklab, var(--navy) 8%, transparent), transparent 50%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
              <span className="inline-block h-px w-8 bg-foreground/40" />
              <span>002 — Who we are</span>
            </div>
            <h1 className="mt-8 max-w-3xl font-display text-balance text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[0.98] tracking-tight text-foreground animate-fade-up delay-100">
              Think before you trust.
              <br />
              <span className="italic text-muted-foreground">Built by people who mean it.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-up delay-200">
              TrustLensAI is a media and information literacy platform. We surface signals — not
              verdicts — so people can evaluate URLs, text, and images before believing or sharing.
            </p>

            <div className="mt-12 flex flex-wrap gap-6 text-sm animate-fade-up delay-300">
              <MetaStat k="6" v="Team members" />
              <MetaStat k="UNESCO" v="Hackathon focus" />
              <MetaStat k="Signals" v="Not oracles" />
            </div>
          </div>
        </section>

        {/* ── Principles ───────────────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Principles
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                  How we work
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
                <PrincipleCard
                  index="01"
                  icon={ShieldCheck}
                  title="Our approach"
                  body="We are not a final authority on truth. We surface signals, evidence, and concerns — and push you to verify with multiple credible sources."
                />
                <PrincipleCard
                  index="02"
                  icon={Sparkles}
                  title="Responsible AI"
                  body="Analysis can be incomplete or biased. We use explainable, hedged language, show why scores appear, and let you control consent and data."
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Powered by Perplexity ────────────────────────── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  The engine
                </div>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                  Powered by Perplexity
                </h2>
              </div>
              <div className="lg:col-span-8">
                <div className="glass relative overflow-hidden rounded-2xl border-white/10 p-6 shadow-elegant sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal/15 text-teal shadow-glow">
                      <Search className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-display text-lg font-semibold tracking-tight">
                        Perplexity Sonar
                      </div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Web-grounded AI · live sources
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                    <a
                      href="https://www.perplexity.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-teal underline-offset-2 hover:underline"
                    >
                      Perplexity
                    </a>{" "}
                    is an AI answer engine that searches the live web and grounds every response in
                    citations from real sources. TrustLensAI runs its verification analysis on
                    Perplexity&apos;s Sonar API: when you submit a URL, claim, or image, Sonar
                    cross-references it against current reporting and credible references — so trust
                    scores reflect what the web actually says right now, not a model&apos;s stale
                    memory.
                  </p>
                  <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <li className="rounded-xl border border-border bg-background/40 px-3 py-2">
                      Real-time web search
                    </li>
                    <li className="rounded-xl border border-border bg-background/40 px-3 py-2">
                      Cited, checkable sources
                    </li>
                    <li className="rounded-xl border border-border bg-background/40 px-3 py-2">
                      Grounded trust signals
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Team ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Ocean field — token-driven so it adapts to light/dark */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, color-mix(in oklab, var(--teal) 6%, var(--background)) 0%, color-mix(in oklab, var(--teal) 12%, var(--background)) 55%, color-mix(in oklab, var(--teal) 22%, var(--background)) 100%)",
            }}
          />

          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="inline-block h-px w-8 bg-foreground/35" />
                  <span>003 — The crew</span>
                </div>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Meet the team
                </h2>
                <p className="mt-3 text-muted-foreground">
                  A cross-functional unit of builders, storytellers, and visual makers shipping
                  TrustLens for the UNESCO media-literacy challenge.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:pb-1">
                6 people · one lens
              </p>
            </div>

            {/* Featured row: first member spans wider on large screens is optional — use equal grid with refined cards */}
            <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM.map((member, i) => (
                <li
                  key={member.name}
                  className={`min-w-0 animate-fade-up ${i % 3 === 1 ? "delay-100" : i % 3 === 2 ? "delay-200" : ""}`}
                >
                  <TeamCard member={member} index={String(i + 1).padStart(2, "0")} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <div className="mx-auto flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="inline-block h-px w-8 bg-foreground/40" />
              <span>004 — Try the lens</span>
              <span className="inline-block h-px w-8 bg-foreground/40" />
            </div>
            <h2 className="mx-auto mt-6 max-w-2xl font-display text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              See what the signals say
              <br />
              <span className="italic text-muted-foreground">before you share.</span>
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full shadow-glow transition-transform hover:scale-[1.02]"
              >
                <Link to="/verify">
                  Verify something <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/learn">Explore courses</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function MetaStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-[7rem]">
      <div className="font-display text-xl font-semibold tracking-tight text-foreground">{k}</div>
      <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">{v}</div>
    </div>
  );
}

function PrincipleCard({
  index,
  icon: Icon,
  title,
  body,
}: {
  index: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className="glass group relative h-full overflow-hidden rounded-2xl border-white/10 p-6 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wider text-muted-foreground">{index}</span>
        <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-teal/10 text-teal transition-all group-hover:border-teal/40 group-hover:shadow-glow">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function TeamCard({ member, index }: { member: (typeof TEAM)[number]; index: string }) {
  const Icon = member.icon;
  return (
    <article className="glass group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border-white/10 p-6 text-center shadow-elegant transition-all duration-300 hover:-translate-y-1.5 hover:border-teal/40 hover:shadow-glow">
      {/* Circular portrait with spinning prism ring */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute -inset-1.5 animate-spin rounded-full bg-[conic-gradient(from_0deg,var(--teal),transparent_110deg,var(--accent)_180deg,transparent_250deg,var(--teal))] opacity-0 blur-[3px] transition-opacity duration-500 [animation-duration:3.5s] group-hover:opacity-90"
        />
        <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-teal/30 shadow-glow transition-colors duration-300 group-hover:border-transparent sm:h-36 sm:w-36">
          <img
            src={member.image}
            alt={member.name}
            className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-110"
            loading="lazy"
          />
        </div>
        {/* Role icon chip */}
        <div className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-teal/30 bg-background text-teal shadow-glow transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-teal transition-all duration-300 group-hover:tracking-[0.3em]">
        {index} · {member.role}
      </div>
      <h3 className="mt-1 font-display text-lg font-semibold leading-tight tracking-tight text-foreground transition-colors duration-300 group-hover:text-teal">
        {member.name}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {member.blurb}
      </p>

      {/* Light sweep across the card */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
      />
    </article>
  );
}
