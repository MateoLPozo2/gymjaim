import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, GitFork, Mail, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Jim's Data Gym — Practice gym for data inference judgment" },
      {
        name: "description",
        content:
          "A controlled, supportive practice gym for junior data scientists. Real pandas in the browser, oracle-graded answers, spaced-repetition email reps that pull you back to sharpen your judgment.",
      },
      { property: "og:title", content: "Jim's Data Gym — Practice gym for data inference judgment" },
      {
        property: "og:description",
        content:
          "Reps for the judgment calls your day job rarely lets you make twice. Try, get scored against the truth, come back in 2 days and try again.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);
  if (authed) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <BrandLogo />
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Button asChild>
            <Link to="/auth">Open the gym</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              For junior data scientists
            </span>
            <h1 className="mt-6 font-display text-5xl md:text-6xl leading-[1.05] tracking-tight">
              A practice gym for the inference calls your day job barely lets you make&nbsp;twice.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              You delete the missing rows, the regression breaks, your PM nods. Did your imputation
              help, hurt, or change the answer entirely? Jim's Data Gym grades every rep against the ground
              truth and emails you back in two days to do it again.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="gap-2">
                <Link to="/auth">
                  Start your first rep <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a
                href="#how"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                See how the gym works ↓
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <HeroSample />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border/60 bg-secondary/50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="font-display text-3xl md:text-4xl tracking-tight">The honest version</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2 text-base leading-relaxed">
            <div>
              <p className="font-medium text-foreground">What you actually do all week</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>· <code>df.dropna()</code> because the deadline is Tuesday.</li>
                <li>· Mean-impute and hope nobody asks why.</li>
                <li>· Run a regression. Eyeball the slope. Ship it.</li>
                <li>· Never find out whether your choice mattered.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">What you'd actually need to get sharper</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>· The <em>same</em> dataset with the <em>same</em> bias re-tried.</li>
                <li>· A score against the truth, not against another junior.</li>
                <li>· Something pulling you back to revisit it after the dust settles.</li>
                <li>· Not another 90-minute YouTube lecture.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-3xl md:text-4xl tracking-tight max-w-xl">
          The gym, in three reps.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Dumbbell,
              title: "Pick a rep",
              body:
                "Browse the public library or upload your own CSV. Every exercise deletes values from one column under a known pattern: random, conditional, or quartile-skewed.",
            },
            {
              icon: Target,
              title: "Make your call",
              body:
                "Write pandas in the browser — real pandas, not a sandboxed lookalike. We grade your regression slope against the slope of the un-deleted data.",
            },
            {
              icon: Mail,
              title: "Reps over time",
              body:
                "We email you back in 2, 7, and 21 days with the same exercise and the same seed. Watch your judgment converge to the optimum across reps.",
            },
          ].map((step, i) => (
            <div key={step.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <step.icon className="h-5 w-5 text-accent" />
                <span className="text-xs font-medium text-muted-foreground">Rep {i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-2xl">{step.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Wedge / weakest point */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-5xl px-6 py-20 grid gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">The wedge</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">
              Kaggle teaches you to win. Jim's Data Gym teaches you to be right.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We're not a tutorial site, not a notebook host, not a leaderboard. Every exercise has a
              ground-truth answer, and the spaced-repetition loop is the product — the reason you'll
              actually get sharper, not just busier.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              The honest weakness
            </p>
            <h3 className="mt-3 font-display text-2xl tracking-tight">
              Oracle scoring needs known truth.
            </h3>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              That limits us to teaching-shaped datasets, not open-ended client work. The bet:
              <em> judgment training is exactly what juniors are missing,</em> and reps on toy data
              are how musicians, athletes, and clinicians get good.
            </p>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">Who's building this</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight">Founder edge</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-[auto_1fr] items-start">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-accent/30 to-secondary border border-border" />
          <div className="text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium">Jim Donahue, founder</p>
            <p className="mt-2">
              Built the original Streamlit version after watching juniors mean-impute their way into
              wrong answers for the third year running. Background in applied stats + ML; reachable at{" "}
              <a className="text-foreground underline underline-offset-4" href="mailto:jimbodonahue@gmail.com">
                jimbodonahue@gmail.com
              </a>
              .
            </p>
            <p className="mt-3 text-sm">
              <em>Placeholder — swap in your real bio &amp; photo from settings.</em>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">
            Stop guessing. Start scoring.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Sign in with Google, pick a dataset, and take your first rep in under two minutes.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" asChild className="gap-2">
              <Link to="/auth">
                Open the gym <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <a href="mailto:jimbodonahue@gmail.com" className="hover:text-foreground">Contact</a>
            <span>© {new Date().getFullYear()} Jim's Data Gym</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroSample() {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <span className="ml-3 text-xs font-mono text-muted-foreground">tips · MCAR · seed 4815</span>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-secondary/60 p-4 text-xs leading-relaxed font-mono">
{`# Your code
df["total_bill"] = df["total_bill"].fillna(
    df.groupby("day")["total_bill"].transform("median")
)`}
      </pre>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Metric label="Expected" value="0.105" />
        <Metric label="Yours" value="0.098" tone="accent" />
        <Metric label="Δ" value="−0.007" tone="success" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground italic">
        Closer to the oracle than mean-imputation. Review reminder set for +2 days.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "success";
}) {
  const color =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
