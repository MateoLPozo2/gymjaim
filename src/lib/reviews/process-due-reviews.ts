import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendReviewReminderEmail } from "@/lib/reviews/send-review-email";

export type ProcessDueReviewOptions = {
  userId?: string;
  recipientEmails?: string[];
  fallbackEmail?: string;
};

export async function processDueReviewQueue(
  supabaseAdmin: SupabaseClient<Database>,
  options: ProcessDueReviewOptions = {},
) {
  let query = supabaseAdmin
    .from("review_queue")
    .select("id, user_id, exercise_id, seed")
    .lte("due_at", new Date().toISOString())
    .is("sent_at", null)
    .limit(50);
  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  const { data: due, error } = await query;
  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return { sent: 0, emails: 0 };

  const sentIds: string[] = [];
  let emailsSent = 0;
  const baseUrl = process.env.LOVABLE_PUBLIC_URL ?? "";

  for (const row of due) {
    try {
      const [{ data: exercise }, { data: userRow }] = await Promise.all([
        supabaseAdmin
          .from("exercises")
          .select("title, difficulty")
          .eq("id", row.exercise_id)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(row.user_id),
      ]);

      if (!exercise) {
        sentIds.push(row.id);
        continue;
      }

      const accountEmail = userRow?.user?.email ?? options.fallbackEmail;
      const recipients =
        options.recipientEmails && options.recipientEmails.length > 0
          ? options.recipientEmails
          : accountEmail
            ? [accountEmail]
            : [];

      if (recipients.length === 0) {
        sentIds.push(row.id);
        continue;
      }

      const link = `${baseUrl}/exercises/${row.exercise_id}?seed=${row.seed}`;
      const templateData = {
        title: exercise.title,
        difficulty: exercise.difficulty,
        link,
      };

      for (const recipient of recipients) {
        try {
          await sendReviewReminderEmail(
            recipient,
            `review-${row.id}-${recipient}`,
            templateData,
          );
          emailsSent += 1;
        } catch (e) {
          console.error("review email send error", e);
        }
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
  return { sent: sentIds.length, emails: emailsSent };
}
