import type { ParsedCsv } from "@/lib/csv";

export function csvToString(p: ParsedCsv): string {
  const header = p.columns.map(escapeCsv).join(",");
  const rows = p.rows.map((r) =>
    r
      .map((v) => (v == null ? "" : typeof v === "number" ? String(v) : escapeCsv(String(v))))
      .join(","),
  );
  return [header, ...rows].join("\n");
}

function escapeCsv(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
