const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipientEmails(raw: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const trimmed = part.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed) || !EMAIL_RE.test(trimmed)) continue;
    seen.add(trimmed);
    emails.push(trimmed);
  }
  return emails;
}
