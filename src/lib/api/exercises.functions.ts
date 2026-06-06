// All app-internal data fetches/mutations live here. Client-safe imports only;
// admin-only helpers (none yet) would be dynamically imported inside handlers.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListExercisesInput = z.object({
  scope: z.enum(["public", "mine", "all"]).default("all"),
});

export const listExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListExercisesInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("exercises")
      .select("id,title,description,difficulty,visibility,dataset_id,created_at,author_id")
      .order("created_at", { ascending: false });
    if (data.scope === "mine") q = q.eq("author_id", userId);
    else if (data.scope === "public") q = q.eq("visibility", "public");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { exercises: rows ?? [] };
  });

const GetExerciseInput = z.object({ id: z.string().uuid() });

export const getExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetExerciseInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ex, error } = await supabase
      .from("exercises")
      .select("*, dataset:datasets(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ex) throw new Error("Exercise not found");
    const ds: any = (ex as any).dataset;
    let datasetCsvUrl: string | null = null;
    if (ds?.storage_path) {
      const { data: signed } = await supabase.storage
        .from("datasets")
        .createSignedUrl(ds.storage_path, 60 * 10);
      datasetCsvUrl = signed?.signedUrl ?? null;
    }
    return { exercise: ex, datasetCsvUrl, viewerId: userId };
  });

const CreateExerciseInput = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  dataset_id: z.string().uuid(),
  target_col: z.string().min(1).max(120),
  y_col: z.string().min(1).max(120),
  condition_col: z.string().max(120).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const createExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateExerciseInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("exercises")
      .insert({
        ...data,
        condition_col: data.condition_col || null,
        author_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const DeleteExerciseInput = z.object({ id: z.string().uuid() });

export const deleteExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteExerciseInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("exercises")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
