import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  ShieldCheck,
  Sparkles,
  Pause,
  Rewind,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroLensDemo } from "@/components/hero-lens-demo";
import { TrustGauge } from "@/components/trust-gauge";
import { useSession } from "@/lib/auth/session";
import heroLens from "@/assets/hero-lens.jpg";
import heroGlass from "@/assets/hero-glass.jpg";
import signalFlow from "@/assets/signal-flow.jpg";
import prism from "@/assets/prism.jpg";
import reader from "@/assets/reader.jpg";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeriSphere AI — Think Before You Trust" },
      {
        name: "description",
        content:
          "Verify online content, understand why it may be trustworthy or misleading, and develop smarter sharing habits.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useSession();
  const revealRef = useReveal<HTMLOListElement>();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Split-screen hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch lg:grid-cols-12">
          {/* Left: statement */}
          {/* Left: statement with glass background */}
          <div className="relative col-span-1 flex flex-col justify-between overflow-hidden px-6 py-16 sm:px-10 sm:py-24 lg:col-span-7 lg:border-r lg:border-border lg:py-32">
            <img
              src={heroGlass}
              alt=""
              aria-hidden="true"
              width={1024}
              height={1024}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 dark:opacity-25"
            />
            <div className="pointer-events-none absolute inset-0 bg-background/60 backdrop-blur-xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/40 via-transparent to-background/70" />
            <div className="relative">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
                <span className="inline-block h-px w-8 bg-foreground/40" />
                <span>001 — Media literacy, quietly</span>
              </div>

              <h1 className="mt-10 font-display text-balance text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-tight text-foreground animate-fade-up delay-100">
                Think before
                <br />
                <span className="italic text-muted-foreground">you trust.</span>
              </h1>

              <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-up delay-200">
                VeriSphere AI reads the signals in a link, a paragraph, or an image — and gives you
                the reasoning behind them. Slower judgement, sharper sharing.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3 animate-fade-up delay-300">
                <Link
                  to={user ? "/verify" : "/auth"}
                  search={user ? undefined : { mode: "signup" }}
                >
                  <Button size="lg" className="rounded-full px-6">
                    <Search className="mr-2 h-4 w-4" />
                    Verify content
                  </Button>
                </Link>
                <Link to="/learn">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="rounded-full px-5 text-foreground hover:bg-accent"
                  >
                    Start learning
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative mt-16 grid grid-cols-3 gap-6 border-t border-border pt-8 text-sm lg:mt-20 animate-fade-up delay-500">
              <Stat k="0–100" v="TrustScore" />
              <Stat k="4" v="Signal categories" />
              <Stat k="5" v="Lesson modules" />
            </div>
          </div>

          {/* Right: mono card / lens */}
          <div className="relative col-span-1 flex items-center justify-center overflow-hidden bg-secondary/40 px-6 py-16 sm:px-10 sm:py-24 lg:col-span-5 lg:py-32">
            <img
              src={heroLens}
              alt=""
              aria-hidden="true"
              width={1024}
              height={1024}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply dark:opacity-25 dark:mix-blend-screen"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal/25 via-teal/10 to-teal/25" />
            <div className="pointer-events-none absolute inset-0 bg-background/20" />
            <div className="relative animate-scale-in delay-300">
              <HeroLensDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Signal flow banner — theme-aware network field */}
      <section className="relative overflow-hidden border-y border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/80 to-teal/20 dark:from-card dark:via-background dark:to-teal/10" />
        <img
          src={signalFlow}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={1024}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-70 mix-blend-multiply sm:object-center dark:opacity-40 dark:mix-blend-screen"
        />
        {/* Teal glow wash so nodes read as brand teal */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-teal/25 via-transparent to-transparent" />
        {/* Left readability veil — keeps type crisp on the network field */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent sm:from-background/95 sm:via-background/55 sm:to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="max-w-xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              How information travels
            </div>
            <h2 className="mt-5 font-display text-[clamp(1.85rem,4.5vw,2.75rem)] font-semibold leading-[1.12] tracking-tight text-foreground">
              Every claim leaves a trail.
              <br />
              <span className="font-display italic font-medium text-muted-foreground">
                We help you read it.
              </span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              From origin to amplification, VeriSphere AI visualises the network of signals behind the
              content you see — so you can decide with clarity.
            </p>
          </div>
        </div>
      </section>

      {/* Feature index */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Index</div>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                A quiet toolkit for
                <br />
                loud information.
              </h2>
            </div>
            <p className="max-w-lg self-end text-muted-foreground">
              Five focused surfaces. No engagement metrics, no dark patterns — just the reasoning
              you need to decide what deserves your attention.
            </p>
          </div>

          {/* Visual pair */}
          <div className="mt-16 grid gap-6 sm:grid-cols-2 sm:items-stretch">
            <figure className="glass relative flex h-full flex-col overflow-hidden rounded-2xl">
              <img
                src={prism}
                alt="A glass prism refracting teal light — a visual metaphor for revealing hidden signals."
                loading="lazy"
                width={1024}
                height={1024}
                className="h-80 w-full object-cover sm:h-96"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent p-5 text-navy-foreground">
                <div className="text-[10px] uppercase tracking-[0.22em] text-navy-foreground/70">
                  Refraction
                </div>
                <div className="mt-1 font-display text-lg font-semibold tracking-tight">
                  Reveal the signals inside a claim.
                </div>
              </figcaption>
            </figure>
            <figure className="glass relative flex h-full flex-col overflow-hidden rounded-2xl">
              <img
                src={reader}
                alt="A person reading calmly on a tablet by a window — thoughtful, unhurried consumption."
                loading="lazy"
                width={1024}
                height={1024}
                className="h-80 w-full object-cover sm:h-96"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent p-5 text-navy-foreground">
                <div className="text-[10px] uppercase tracking-[0.22em] text-navy-foreground/70">
                  Practice
                </div>
                <div className="mt-1 font-display text-lg font-semibold tracking-tight">
                  Slower reading, sharper judgement.
                </div>
              </figcaption>
            </figure>
          </div>

          <ol ref={revealRef} className="mt-16 space-y-2 border-t border-border pt-4">
            {features.map((f, i) => (
              <li
                key={f.title}
                data-reveal
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-transparent px-4 py-5 opacity-100 transition-[border-color,background-color,box-shadow] duration-200 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_2.75rem] sm:items-center sm:gap-8 sm:px-5 motion-safe:opacity-0 motion-safe:[&.animate-fade-up]:opacity-100 [@media(hover:hover)]:hover:border-border [@media(hover:hover)]:hover:bg-muted/40 [@media(hover:hover)]:hover:shadow-sm"
              >
                {/* Left accent — only on real hover devices, never a full-row color flood */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-full bg-teal/0 transition-colors duration-200 [@media(hover:hover)]:group-hover:bg-teal/70"
                />
                <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {f.body}
                  </p>
                </div>
                <div className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
                  {f.tag}
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background/40 text-foreground transition-colors duration-200 [@media(hover:hover)]:group-hover:border-teal/50 [@media(hover:hover)]:group-hover:bg-teal/10 [@media(hover:hover)]:group-hover:text-teal">
                  <f.icon className="h-4 w-4" aria-hidden />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
          <div className="grid gap-12 md:grid-cols-2 md:items-end">
            <div>
              <h2 className="font-display text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                Ready to see
                <br />
                the signals?
              </h2>
              <div className="mt-8 hidden opacity-70 sm:block">
                <TrustGauge score={82} category="high_trust" size={140} />
              </div>
            </div>
            <div className="md:pb-2">
              <p className="max-w-md text-muted-foreground">
                Sign up free, give AI-processing consent, and run your first verification in under a
                minute.
              </p>
              <div className="mt-6">
                <Link
                  to={user ? "/dashboard" : "/auth"}
                  search={user ? undefined : { mode: "signup" }}
                >
                  <Button size="lg" className="rounded-full px-6">
                    {user ? "Go to dashboard" : "Create your account"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold tracking-tight">{k}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{v}</div>
    </div>
  );
}

const features = [
  {
    icon: ShieldCheck,
    title: "TrustScore",
    tag: "Signal",
    body: "A transparent 0–100 signal with four clear categories: High Trust, Needs Verification, Low Confidence, Potentially Misleading.",
  },
  {
    icon: Sparkles,
    title: "Explainable AI",
    tag: "Reasoning",
    body: "See why a score was generated. Every result surfaces evidence, concerns, and next steps you can take.",
  },
  {
    icon: Pause,
    title: "Pause Before Sharing",
    tag: "Friction",
    body: "A gentle interruption when signals are weak. Review the reasoning before amplifying content.",
  },
  {
    icon: Rewind,
    title: "TrustReplay",
    tag: "Timeline",
    body: "Visualize how questionable content may spread across platforms — origin, amplification, reach.",
  },
  {
    icon: GraduationCap,
    title: "Learning Modules",
    tag: "Practice",
    body: "Short lessons and quizzes on spotting misleading headlines, verifying media, and checking sources.",
  },
];
