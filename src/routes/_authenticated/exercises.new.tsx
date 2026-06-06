import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { listDatasets, createDataset, profileDatasetUpload } from "@/lib/api/datasets.functions";
import { createExercise } from "@/lib/api/exercises.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, ArrowLeft } from "lucide-react";
import { DatasetUploadPreview } from "@/components/datasets/DatasetUploadPreview";
import type { DatasetProfile } from "@/lib/datasets/profile-local";

export const Route = createFileRoute("/_authenticated/exercises/new")({
  head: () => ({ meta: [{ title: "New exercise — Jim's Data Gym" }] }),
  component: NewExercise,
});

function NewExercise() {
  const navigate = useNavigate();
  const listFn = useServerFn(listDatasets);
  const createDsFn = useServerFn(createDataset);
  const createExFn = useServerFn(createExercise);
  const profileFn = useServerFn(profileDatasetUpload);
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listFn() });

  const [datasetId, setDatasetId] = useState<string>("");
  const [targetCol, setTargetCol] = useState<string>("");
  const [yCol, setYCol] = useState<string>("");
  const [conditionCol, setConditionCol] = useState<string>("__none__");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const selected = (datasets.data?.datasets ?? []).find((d: any) => d.id === datasetId);
  const cols: string[] = Array.isArray(selected?.columns)
    ? (selected.columns as unknown[]).filter((c): c is string => typeof c === "string")
    : [];

  useEffect(() => {
    if (!targetCol && cols[0]) setTargetCol(cols[0]);
    if (!yCol && cols[1]) setYCol(cols[1]);
  }, [datasetId, cols.join("|")]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!datasetId) throw new Error("Pick a dataset");
      if (!targetCol || !yCol) throw new Error("Pick target and y columns");
      const { id } = await createExFn({
        data: {
          title,
          description,
          dataset_id: datasetId,
          target_col: targetCol,
          y_col: yCol,
          condition_col: conditionCol === "__none__" ? null : conditionCol,
          difficulty,
          visibility,
        },
      });
      return id;
    },
    onSuccess: (id) => {
      toast.success("Exercise created");
      navigate({ to: "/exercises/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to exercises
      </Link>
      <h1 className="mt-3 font-display text-3xl tracking-tight">Author a new exercise</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick the dataset, the variable we'll delete from, the variable we regress against, and how hard the missingness should be.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-display text-lg">Dataset</CardTitle>
          <CardDescription>Built-in samples and public community uploads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={datasetId} onValueChange={setDatasetId}>
            <SelectTrigger><SelectValue placeholder="Choose a dataset…" /></SelectTrigger>
            <SelectContent>
              {(datasets.data?.datasets ?? []).map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}{d.is_builtin ? " · built-in" : d.is_public ? " · public" : " · mine"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UploadInline
            onCreated={(id) => setDatasetId(id)}
            createDsFn={createDsFn}
            profileFn={profileFn}
          />
        </CardContent>
      </Card>

      {selected && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-lg">Variables &amp; difficulty</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Target (we delete values from this column)">
              <Select value={targetCol} onValueChange={setTargetCol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Y (regress target → y)">
              <Select value={yCol} onValueChange={setYCol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cols.filter((c) => c !== targetCol).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condition column (optional, for medium/hard)">
              <Select value={conditionCol} onValueChange={setConditionCol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Auto-pick</SelectItem>
                  {cols.filter((c) => c !== targetCol && c !== yCol).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy — missing at random</SelectItem>
                  <SelectItem value="medium">Medium — conditional on a variable</SelectItem>
                  <SelectItem value="hard">Hard — quartile-skewed conditional</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Title &amp; visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Impute tip when total_bill is missing" />
          </Field>
          <Field label="Description (optional)">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Why this exercise is useful, hints, etc." />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Publish to public library</p>
              <p className="text-xs text-muted-foreground">Otherwise it's private to you.</p>
            </div>
            <Switch checked={visibility === "public"} onCheckedChange={(v) => setVisibility(v ? "public" : "private")} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to="/exercises">Cancel</Link>
        </Button>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !datasetId || !targetCol || !yCol || !title}>
          {mut.isPending ? "Creating…" : "Create exercise"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function UploadInline({
  onCreated,
  createDsFn,
  profileFn,
}: {
  onCreated: (id: string) => void;
  createDsFn: (args: { data: Parameters<typeof createDataset>[0] extends never ? never : any }) => Promise<{ id: string }>;
  profileFn: (args: { data: { csv_text: string; filename: string } }) => Promise<{ profile: DatasetProfile }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);

  async function onPick(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("CSV exceeds 5 MB limit");
      return;
    }
    setBusy(true);
    setProfile(null);
    try {
      const text = await file.text();
      const { profile: p } = await profileFn({
        data: { csv_text: text, filename: file.name },
      });
      setProfile(p as DatasetProfile);
      setPendingFile(file);
      setPendingText(text);
      if (!name) setName(file.name.replace(/\.csv$/i, ""));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not profile CSV");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmUpload() {
    if (!pendingFile || !pendingText || !profile) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const path = `${uid}/${Date.now()}-${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("datasets")
        .upload(path, pendingFile, { contentType: "text/csv", upsert: false });
      if (upErr) throw upErr;
      const { id } = await createDsFn({
        data: {
          name: name || pendingFile.name.replace(/\.csv$/i, ""),
          description: `Uploaded ${new Date().toLocaleDateString()}`,
          storage_path: path,
          columns: profile.column_names,
          is_public: false,
        },
      });
      toast.success("Dataset uploaded");
      setProfile(null);
      setPendingFile(null);
      setPendingText(null);
      onCreated(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium">Or upload a CSV (≤ 5 MB)</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <Input
          placeholder="Optional name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        <Button
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> {busy && !profile ? "Profiling…" : "Choose CSV"}
        </Button>
      </div>
      {profile && (
        <>
          <DatasetUploadPreview profile={profile} />
          <div className="mt-3 flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProfile(null);
                setPendingFile(null);
                setPendingText(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={onConfirmUpload}>
              {busy ? "Uploading…" : "Confirm upload"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
