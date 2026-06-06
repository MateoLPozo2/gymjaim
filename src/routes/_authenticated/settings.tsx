import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, setEmailCadence } from "@/lib/api/attempts.functions";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GymJaim" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const setFn = useServerFn(setEmailCadence);
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });

  const mut = useMutation({
    mutationFn: (enabled: boolean) => setFn({ data: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Saved");
    },
  });

  const enabled = profile.data?.profile?.email_cadence_enabled ?? true;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-display text-lg">Spaced-repetition reminders</CardTitle>
          <CardDescription>
            Every rep schedules emails at +2, +7, and +21 days so you can revisit the same exercise
            (same seed) and watch your judgment improve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">Email me my reminders</p>
              <p className="text-xs text-muted-foreground mt-1">
                Turn off to keep practice in-app only.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={profile.isLoading || mut.isPending}
              onCheckedChange={(v) => mut.mutate(v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
