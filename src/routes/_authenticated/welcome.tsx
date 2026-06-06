import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getOnboardingStatus,
  saveOnboarding,
  getStarterSuggestions,
} from "@/lib/onboarding.functions";
import { CURRICULUM, ROLE_OPTIONS } from "@/lib/onboarding/curriculum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Jim's Data Gym" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force === true || search.force === "true" || search.force === "1",
  }),
  component: WelcomePage,
});

type Suggestion = {
  id: string;
  title: string;
  description: string | null;
  difficulty: "easy" | "medium" | "hard";
};

function WelcomePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { force } = Route.useSearch();
  const statusFn = useServerFn(getOnboardingStatus);
  const saveFn = useServerFn(saveOnboarding);
  const suggestFn = useServerFn(getStarterSuggestions);

  const status = useQuery({ queryKey: ["onboarding-status"], queryFn: () => statusFn() });

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [role, setRole] = useState<string>("");
  const [roleCustom, setRoleCustom] = useState("");
  const [goals, setGoals] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Auto-advance from the hello screen
  useEffect(() => {
    if (step !== 0) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setStep(1), reduce ? 900 : 2600);
    return () => clearTimeout(t);
  }, [step]);

  // Skip flow if already onboarded — unless the user explicitly asked to re-run it
  useEffect(() => {
    if (force) return;
    if (status.data && !status.data.needsWelcome) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [status.data, navigate, force]);

  // Pre-fill from existing profile if re-running
  useEffect(() => {
    const p = status.data?.profile;
    if (!p) return;
    if (p.role && ROLE_OPTIONS.includes(p.role as (typeof ROLE_OPTIONS)[number])) {
      setRole(p.role);
    }
    if (p.role_custom) setRoleCustom(p.role_custom);
    if (p.goals) setGoals(p.goals);
    if (Array.isArray(p.preferred_topics)) setTopics(p.preferred_topics);
  }, [status.data]);

  const firstName = useMemo(() => {
    const dn = status.data?.profile?.display_name ?? "";
    return dn.split(" ")[0] ?? "";
  }, [status.data]);

  const advance = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const roleValid = role !== "" && (role !== "Other" || roleCustom.trim().length > 0);
  const topicsValid = topics.length >= 1;

  const toggleTopic = (t: string) =>
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async () => {
    if (!roleValid || !topicsValid) return;
    setSubmitting(true);
    try {
      await saveFn({
        data: {
          role: role as (typeof ROLE_OPTIONS)[number],
          role_custom: role === "Other" ? roleCustom.trim() : null,
          goals: goals.trim() || null,
          preferred_topics: topics,
        },
      });
      const res = await suggestFn({ data: { topics } });
      setSuggestions(res.suggestions as Suggestion[]);
      advance(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save preferences");
    } finally {
      setSubmitting(false);
    }
  };

  const finish = (target?: { to: string; params?: Record<string, string> }) => {
    router.invalidate();
    if (target) {
      navigate(target as any);
    } else {
      navigate({ to: "/dashboard", replace: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background">
      {/* Aurora background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 30%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(50% 50% at 80% 70%, color-mix(in oklab, var(--accent) 20%, transparent), transparent 60%), radial-gradient(40% 40% at 60% 20%, color-mix(in oklab, var(--secondary) 22%, transparent), transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      <div
        key={step}
        className="relative w-full max-w-2xl px-6 animate-in fade-in slide-in-from-right-6 duration-500"
        style={{
          animationName: direction === 1 ? undefined : "fade-in",
        }}
      >
        {step === 0 && <HelloStep firstName={firstName} onSkip={() => advance(1)} />}
        {step === 1 && (
          <RoleStep
            role={role}
            setRole={setRole}
            roleCustom={roleCustom}
            setRoleCustom={setRoleCustom}
            goals={goals}
            setGoals={setGoals}
            canContinue={roleValid}
            onContinue={() => advance(2)}
          />
        )}
        {step === 2 && (
          <TopicsStep
            topics={topics}
            toggleTopic={toggleTopic}
            canContinue={topicsValid}
            submitting={submitting}
            onBack={() => advance(1)}
            onContinue={handleSubmit}
          />
        )}
        {step === 3 && <SuggestionsStep suggestions={suggestions} onFinish={finish} />}
      </div>

      {step > 0 && step < 3 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                step >= i ? "bg-foreground" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HelloStep({ firstName, onSkip }: { firstName: string; onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="block w-full text-center cursor-pointer"
      aria-label="Continue"
    >
      <h1
        className="font-display text-7xl md:text-9xl tracking-tight text-foreground animate-in fade-in zoom-in-95 duration-[1400ms]"
        style={{ fontWeight: 300 }}
      >
        hello{firstName ? `, ${firstName}` : ""}.
      </h1>
      <p className="mt-8 text-sm text-muted-foreground animate-in fade-in duration-[2000ms]">
        Tap anywhere to begin
      </p>
    </button>
  );
}

function RoleStep(props: {
  role: string;
  setRole: (v: string) => void;
  roleCustom: string;
  setRoleCustom: (v: string) => void;
  goals: string;
  setGoals: (v: string) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1 of 2</p>
        <h2 className="mt-2 font-display text-4xl tracking-tight">Who are you?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Helps us point you to the right reps. Takes 20 seconds.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Your role</Label>
        <Select value={props.role} onValueChange={props.setRole}>
          <SelectTrigger id="role">
            <SelectValue placeholder="Pick the closest match" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {props.role === "Other" && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label htmlFor="role-custom">Tell us your role *</Label>
          <Input
            id="role-custom"
            value={props.roleCustom}
            onChange={(e) => props.setRoleCustom(e.target.value)}
            placeholder="e.g. Marketing Manager"
            maxLength={120}
            autoFocus
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="goals">
          Your goals <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="goals"
          value={props.goals}
          onChange={(e) => props.setGoals(e.target.value.slice(0, 280))}
          placeholder="What do you want to get better at?"
          rows={3}
          maxLength={280}
        />
        <p className="text-xs text-muted-foreground text-right">{props.goals.length}/280</p>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={props.onContinue} disabled={!props.canContinue} size="lg" className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TopicsStep(props: {
  topics: string[];
  toggleTopic: (t: string) => void;
  canContinue: boolean;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 2 of 2</p>
        <h2 className="mt-2 font-display text-4xl tracking-tight">What do you want to practice?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick anything that grabs you — we'll line up three starter exercises.
        </p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto pr-2 space-y-5 rounded-lg border border-border p-4 bg-card/50">
        {CURRICULUM.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground/80">
                {group.label}
              </h3>
              {group.comingSoon && (
                <Badge variant="secondary" className="text-[10px]">
                  coming soon
                </Badge>
              )}
            </div>
            {group.topics.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground italic">
                We're building this. Check back soon.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.topics.map((t) => {
                  const active = props.topics.includes(t);
                  return (
                    <label
                      key={t}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        active
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={() => props.toggleTopic(t)}
                      />
                      <span>{t}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={props.onBack}>
          Back
        </Button>
        <Button
          onClick={props.onContinue}
          disabled={!props.canContinue || props.submitting}
          size="lg"
          className="gap-2"
        >
          {props.submitting ? "Saving…" : "See my starter set"}
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {props.topics.length} topic{props.topics.length === 1 ? "" : "s"} selected
      </p>
    </div>
  );
}

function SuggestionsStep({
  suggestions,
  onFinish,
}: {
  suggestions: Suggestion[];
  onFinish: (target?: { to: string; params?: Record<string, string> }) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Your starter set</p>
        <h2 className="mt-2 font-display text-4xl tracking-tight">Three reps to begin.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hand-picked from your topics. You can always browse the full library later.
        </p>
      </div>

      <div className="space-y-3">
        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No matching exercises yet — head to the library to explore what's available.
          </div>
        ) : (
          suggestions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onFinish({ to: "/exercises/$id", params: { id: s.id } })}
              className="w-full text-left rounded-lg border border-border bg-card p-4 hover:border-foreground/60 transition-colors animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 120}ms`, animationFillMode: "backwards" }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg">{s.title}</h3>
                <Badge variant="outline" className="capitalize">
                  {s.difficulty}
                </Badge>
              </div>
              {s.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
        {suggestions[0] && (
          <Button
            size="lg"
            className="gap-2"
            onClick={() =>
              onFinish({ to: "/exercises/$id", params: { id: suggestions[0].id } })
            }
          >
            Start now <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => onFinish()}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
