type ReviewEmailData = {
  title: string;
  difficulty: string;
  link: string;
};

export async function sendReviewReminderEmail(
  recipientEmail: string,
  idempotencyKey: string,
  templateData: ReviewEmailData,
) {
  const baseUrl = process.env.LOVABLE_PUBLIC_URL ?? "";
  const res = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateName: "review-reminder",
      recipientEmail,
      idempotencyKey,
      templateData,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Email send failed (${res.status})`);
  }
}
