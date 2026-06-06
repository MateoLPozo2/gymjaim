import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_TOPICS, ROLE_OPTIONS } from "@/lib/onboarding/curriculum";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,display_name,onboarding_completed_at,role,role_custom,goals,preferred_topics,welcome_on_next_login",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const needsWelcome = !data?.onboarding_completed_at || !!data?.welcome_on_next_login;
    return { profile: data ?? null, needsWelcome };
  });

const SaveOnboardingInput = z.object({
  role: z.enum(ROLE_OPTIONS),
  role_custom: z.string().trim().max(120).nullable().optional(),
  goals: z.string().trim().max(280).nullable().optional(),
  preferred_topics: z.array(z.string().min(1).max(120)).min(1).max(64),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const parsed = SaveOnboardingInput.parse(d);
    if (parsed.role === "Other" && !parsed.role_custom?.trim()) {
      throw new Error("Please describe your role.");
    }
    const validTopics = new Set(ALL_TOPICS);
    const topics = parsed.preferred_topics.filter((t) => validTopics.has(t));
    if (topics.length === 0) throw new Error("Pick at least one topic.");
    return { ...parsed, preferred_topics: topics };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        role: data.role,
        role_custom: data.role === "Other" ? data.role_custom ?? null : null,
        goals: data.goals ?? null,
        preferred_topics: data.preferred_topics,
        onboarding_completed_at: new Date().toISOString(),
        welcome_on_next_login: false,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SetWelcomeFlagInput = z.object({ enabled: z.boolean() });

export const setWelcomeOnNextLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetWelcomeFlagInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ welcome_on_next_login: data.enabled })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SuggestionsInput = z.object({
  topics: z.array(z.string().min(1).max(120)).min(1).max(64),
});

type ExerciseRow = {
  id: string;
  title: string;
  description: string | null;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
};

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

export const getStarterSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuggestionsInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id,title,description,difficulty,created_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const exercises = (rows ?? []) as ExerciseRow[];

    const topicsLower = data.topics.map((t) => t.toLowerCase());
    const matches = (ex: ExerciseRow) => {
      const hay = `${ex.title} ${ex.description ?? ""}`.toLowerCase();
      return topicsLower.some((t) => hay.includes(t));
    };

    let pool = exercises.filter(matches);
    if (pool.length === 0) pool = exercises;

    pool.sort(
      (a, b) =>
        DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty] ||
        a.created_at.localeCompare(b.created_at),
    );

    const picked: ExerciseRow[] = [];
    const seen = new Set<string>();
    const tryPick = (level: ExerciseRow["difficulty"]) => {
      const found = pool.find((e) => e.difficulty === level && !seen.has(e.id));
      if (found) {
        picked.push(found);
        seen.add(found.id);
      }
    };
    tryPick("easy");
    tryPick("medium");
    tryPick("hard");
    for (const e of pool) {
      if (picked.length >= 3) break;
      if (!seen.has(e.id)) {
        picked.push(e);
        seen.add(e.id);
      }
    }
    return { suggestions: picked.slice(0, 3) };
  });
