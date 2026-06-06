import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDatasets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("datasets")
      .select("*")
      .order("is_builtin", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { datasets: data ?? [] };
  });

const CreateDatasetInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  storage_path: z.string().min(1).max(500),
  columns: z.array(z.string().min(1).max(120)).min(1).max(64),
  is_public: z.boolean().default(false),
});

export const createDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateDatasetInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("datasets")
      .insert({ ...data, owner_id: userId, is_builtin: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const ToggleDatasetPublicInput = z.object({
  id: z.string().uuid(),
  is_public: z.boolean(),
});

export const toggleDatasetPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ToggleDatasetPublicInput.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("datasets")
      .update({ is_public: data.is_public })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GetSignedUrlInput = z.object({ storage_path: z.string().min(1) });

export const getDatasetSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetSignedUrlInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("datasets")
      .createSignedUrl(data.storage_path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

const GetDatasetDetailInput = z.object({ id: z.string().uuid() });

export const getDatasetDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetDatasetDetailInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: ds, error } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ds) throw new Error("Dataset not found");
    let csvUrl: string | null = null;
    if (ds.storage_path) {
      const { data: signed } = await supabase.storage
        .from("datasets")
        .createSignedUrl(ds.storage_path, 60 * 10);
      csvUrl = signed?.signedUrl ?? null;
    }
    return { dataset: ds, csvUrl };
  });
