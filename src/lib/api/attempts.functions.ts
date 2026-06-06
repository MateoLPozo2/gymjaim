import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecordAttemptInput = z.object({
  exercise_id: z.string().uuid(),
  seed: z.number().int(),
  code: z.string().max(20000).optional().default(""),
  user_slope: z.number().nullable(),
  expected_slope: z.number().nullable(),
  optimal_slope: z.number().nullable(),
  slope_delta: z.number().nullable(),
  matched_oracle: z.boolean(),
});

export const recordAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecordAttemptInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("attempts").insert({
      ...data,
      user_id: userId,
    });
    if (error) throw new Error(error.message);

    // Schedule spaced-repetition reminders (2 / 7 / 21 days).
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_cadence_enabled")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.email_cadence_enabled !== false) {
      const offsets = [2, 7, 21];
      const rows = offsets.map((days) => ({
        user_id: userId,
        exercise_id: data.exercise_id,
        seed: data.seed,
        due_at: new Date(Date.now() + days * 86400_000).toISOString(),
      }));
      await supabase.from("review_queue").insert(rows);
    }
    return { ok: true };
  });

export const listAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attempts")
      .select("id,exercise_id,seed,user_slope,expected_slope,optimal_slope,slope_delta,matched_oracle,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { attempts: data ?? [] };
  });

export const listDueReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("review_queue")
      .select("id,exercise_id,seed,due_at,sent_at")
      .lte("due_at", new Date().toISOString())
      .is("sent_at", null)
      .order("due_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return { reviews: data ?? [] };
  });

const SetCadenceInput = z.object({ enabled: z.boolean() });
export const setEmailCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetCadenceInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ email_cadence_enabled: data.enabled })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data };
  });
