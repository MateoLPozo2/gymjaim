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

    let scheduled = true;
    try {
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
        const { error: reviewError } = await supabase.from("review_queue").insert(rows);
        if (reviewError) {
          console.error("[recordAttempt] review scheduling failed:", reviewError.message);
          scheduled = false;
        }
      }
    } catch (e) {
      console.error("[recordAttempt] review scheduling failed:", e);
      scheduled = false;
    }

    return { ok: true, scheduled };
  });

export const listAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attempts")
      .select(
        "id,exercise_id,seed,user_slope,expected_slope,optimal_slope,slope_delta,matched_oracle,created_at",
      )
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

export const listScheduledReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("review_queue")
      .select("id, exercise_id, seed, due_at, sent_at, created_at")
      .order("due_at", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);
    return { reviews: data ?? [] };
  });

const ScheduleTestReviewInput = z.object({
  exercise_id: z.string().uuid().optional(),
  seed: z.number().int().optional(),
});

export const scheduleTestReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScheduleTestReviewInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let exerciseId = data.exercise_id;
    let seed = data.seed;

    if (!exerciseId || seed == null) {
      const { data: last, error } = await supabase
        .from("attempts")
        .select("exercise_id, seed")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!last) throw new Error("No attempts yet — save a rep first");
      exerciseId = last.exercise_id;
      seed = last.seed;
    }

    const { error } = await supabase.from("review_queue").insert({
      user_id: userId,
      exercise_id: exerciseId!,
      seed: seed!,
      due_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, exercise_id: exerciseId, seed };
  });

const ProcessDueReviewsInput = z.object({
  recipient_emails: z.array(z.string().email()).optional().default([]),
});

export const processDueReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProcessDueReviewsInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processDueReviewQueue } = await import("@/lib/reviews/process-due-reviews");

    const { data: userData } = await context.supabase.auth.getUser();
    const fallbackEmail = userData.user?.email ?? undefined;

    return processDueReviewQueue(supabaseAdmin, {
      userId: context.userId,
      recipientEmails: data.recipient_emails,
      fallbackEmail,
    });
  });
