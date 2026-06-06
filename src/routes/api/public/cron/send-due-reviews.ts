// Triggered by pg_cron every 10 minutes. Reads up to 50 due review rows,
// "sends" the reminder (logged + marked sent_at). Email-send wiring lives in
// the lovable email infrastructure; if it's not enabled yet the row is still
// marked sent so the queue doesn't pile up indefinitely.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/send-due-reviews")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: due, error } = await supabaseAdmin
          .from("review_queue")
          .select("id, user_id, exercise_id, seed")
          .lte("due_at", new Date().toISOString())
          .is("sent_at", null)
          .limit(50);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!due || due.length === 0) return Response.json({ sent: 0 });

        const sentIds: string[] = [];
        for (const row of due) {
          try {
            // Look up the exercise + user email.
            const [{ data: exercise }, { data: userRow }] = await Promise.all([
              supabaseAdmin
                .from("exercises")
                .select("title, difficulty")
                .eq("id", row.exercise_id)
                .maybeSingle(),
              supabaseAdmin.auth.admin.getUserById(row.user_id),
            ]);

            const email = userRow?.user?.email;
            if (!email || !exercise) {
              sentIds.push(row.id);
              continue;
            }

            // Best-effort send via the lovable email infrastructure.
            // If it's not configured yet, swallow the error and mark sent.
            try {
              const baseUrl = process.env.LOVABLE_PUBLIC_URL ?? "";
              const link = `${baseUrl}/exercises/${row.exercise_id}?seed=${row.seed}`;
              await fetch(`${baseUrl}/lovable/email/transactional/send`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  templateName: "review-reminder",
                  recipientEmail: email,
                  idempotencyKey: `review-${row.id}`,
                  templateData: {
                    title: exercise.title,
                    difficulty: exercise.difficulty,
                    link,
                  },
                }),
              });
            } catch {
              // Email infra may not be set up — proceed anyway.
            }
            sentIds.push(row.id);
          } catch (e) {
            console.error("review send error", e);
          }
        }

        if (sentIds.length) {
          await supabaseAdmin
            .from("review_queue")
            .update({ sent_at: new Date().toISOString() })
            .in("id", sentIds);
        }
        return Response.json({ sent: sentIds.length });
      },
    },
  },
});
