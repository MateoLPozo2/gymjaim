import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  getMyProfile,
  setEmailCadence,
  listScheduledReviews,
  scheduleTestReview,
  processDueReviews,
} from "@/lib/api/attempts.functions";
import { listMyDatasets } from "@/lib/api/datasets.functions";
import { VOICE_COACH_STORAGE_KEY } from "@/hooks/use-voice-coach";
import { parseRecipientEmails } from "@/lib/reviews/parse-recipient-emails";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Mail, Send, Volume2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Jim's Data Gym" }] }),
  component: SettingsPage,
});

const REVIEW_RECIPIENTS_KEY = "jims-data-gym-review-recipients";

function SettingsPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const accountEmail = user.email ?? "";
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const setFn = useServerFn(setEmailCadence);
  const myDsFn = useServerFn(listMyDatasets);
  const reviewsFn = useServerFn(listScheduledReviews);
  const scheduleFn = useServerFn(scheduleTestReview);
  const processFn = useServerFn(processDueReviews);

  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const myDatasets = useQuery({ queryKey: ["my-datasets"], queryFn: () => myDsFn() });
  const reviews = useQuery({ queryKey: ["scheduled-reviews"], queryFn: () => reviewsFn() });

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const recipientRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVoiceEnabled(localStorage.getItem(VOICE_COACH_STORAGE_KEY) === "true");
    setRecipientInput(localStorage.getItem(REVIEW_RECIPIENTS_KEY) ?? "");
  }, []);

  useEffect(() => {
    const el = recipientRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 60)}px`;
  }, [recipientInput]);

  const resolvedRecipients = () => {
    const parsed = parseRecipientEmails(recipientInput);
    return parsed.length > 0 ? parsed : accountEmail ? [accountEmail] : [];
  };

  const persistRecipients = (value: string) => {
    setRecipientInput(value);
    localStorage.setItem(REVIEW_RECIPIENTS_KEY, value);
  };

  const runProcessDueReviews = async () => {
    const parsed = parseRecipientEmails(recipientInput);
    return processFn({ data: { recipient_emails: parsed } });
  };

  const cadenceMut = useMutation({
    mutationFn: (enabled: boolean) => setFn({ data: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Saved");
    },
  });

  const scheduleMut = useMutation({
    mutationFn: async () => {
      await scheduleFn({ data: {} });
      return runProcessDueReviews();
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["scheduled-reviews"] });
      qc.invalidateQueries({ queryKey: ["reviews-due"] });
      const targets = resolvedRecipients();
      toast.success(
        `Test reminder sent — ${r.emails} email(s) to ${targets.length} recipient(s)`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const processMut = useMutation({
    mutationFn: runProcessDueReviews,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["scheduled-reviews"] });
      qc.invalidateQueries({ queryKey: ["reviews-due"] });
      const targets = resolvedRecipients();
      if (r.sent === 0) {
        toast.info("No due reviews to send right now");
        return;
      }
      toast.success(
        `Sent ${r.emails} review email(s) for ${r.sent} due item(s) to ${targets.join(", ")}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">Email me my reminders</p>
              <p className="text-xs text-muted-foreground mt-1">
                Turn off to keep practice in-app only.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={profile.isLoading || cadenceMut.isPending}
              onCheckedChange={(v) => cadenceMut.mutate(v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-recipients" className="text-sm">
              Notification recipients
            </Label>
            <Textarea
              id="review-recipients"
              ref={recipientRef}
              value={recipientInput}
              onChange={(e) => persistRecipients(e.target.value)}
              placeholder={
                accountEmail
                  ? `Leave empty to use your account email (${accountEmail}). One address per line or comma-separated.`
                  : "One email per line or comma-separated."
              }
              rows={1}
              className="min-h-[60px] resize-none overflow-hidden"
            />
            <p className="text-xs text-muted-foreground">
              {parseRecipientEmails(recipientInput).length > 0
                ? `Will send to: ${parseRecipientEmails(recipientInput).join(", ")}`
                : accountEmail
                  ? `Defaults to your account email: ${accountEmail}`
                  : "Add at least one email, or sign in with an account that has an email."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={processMut.isPending || (!accountEmail && !recipientInput.trim())}
              onClick={() => processMut.mutate()}
            >
              <Send className="h-4 w-4" />
              {processMut.isPending ? "Sending…" : "Send due review emails"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={scheduleMut.isPending || (!accountEmail && !recipientInput.trim())}
              onClick={() => scheduleMut.mutate()}
            >
              <Mail className="h-4 w-4" /> Send test reminder now
            </Button>
          </div>

          {(reviews.data?.reviews ?? []).length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Scheduled reviews
              </p>
              <ul className="space-y-1.5 text-xs font-mono">
                {(reviews.data?.reviews ?? []).slice(0, 5).map((r: any) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      exercise {r.exercise_id.slice(0, 8)}… · seed {r.seed}
                    </span>
                    <span>
                      {r.sent_at ? "sent" : new Date(r.due_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5" /> Voice coach
          </CardTitle>
          <CardDescription>
            ElevenLabs reads exercise briefings and post-rep debriefs aloud in the runner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">Enable voice coach</p>
              <p className="text-xs text-muted-foreground mt-1">
                Briefing on exercise open; debrief after saving a rep.
              </p>
            </div>
            <Switch
              checked={voiceEnabled}
              onCheckedChange={(v) => {
                setVoiceEnabled(v);
                localStorage.setItem(VOICE_COACH_STORAGE_KEY, v ? "true" : "false");
                toast.success(v ? "Voice coach on" : "Voice coach off");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">My datasets</CardTitle>
          <CardDescription>CSV uploads you own. View headers and previews on each detail page.</CardDescription>
        </CardHeader>
        <CardContent>
          {myDatasets.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (myDatasets.data?.datasets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No uploads yet.{" "}
              <Link to="/exercises/new" className="text-foreground underline underline-offset-2">
                Upload via new exercise
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(myDatasets.data?.datasets ?? []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <Link
                      to="/datasets/$id"
                      params={{ id: d.id }}
                      className="font-medium hover:underline"
                    >
                      {d.name}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {(d.columns ?? []).length} columns
                    </p>
                  </div>
                  <Link
                    to="/datasets/$id"
                    params={{ id: d.id }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
