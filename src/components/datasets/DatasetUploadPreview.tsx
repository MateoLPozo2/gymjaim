import type { DatasetProfile } from "@/lib/datasets/profile-local";

export function DatasetUploadPreview({ profile }: { profile: DatasetProfile }) {
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium">
        Profile · {profile.row_count.toLocaleString()} rows · {profile.column_names.length} columns ·{" "}
        {profile.numeric_columns.length} numeric
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs font-mono">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-3 py-2">Column</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Non-null</th>
              <th className="text-left px-3 py-2">Missing</th>
            </tr>
          </thead>
          <tbody>
            {profile.columns.map((c) => (
              <tr key={c.name} className="border-t border-border/60">
                <td className="px-3 py-1.5 font-semibold">{c.name}</td>
                <td className="px-3 py-1.5">{c.dtype}</td>
                <td className="px-3 py-1.5">{c.non_null}</td>
                <td className="px-3 py-1.5">{c.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-md border border-border max-h-64">
        <table className="w-full text-xs font-mono">
          <thead className="bg-secondary sticky top-0">
            <tr>
              {profile.column_names.map((c) => (
                <th key={c} className="text-left px-3 py-1.5 font-semibold whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.preview_rows.map((row, i) => (
              <tr key={i} className="border-t border-border/60">
                {profile.column_names.map((c) => (
                  <td key={c} className="px-3 py-1 whitespace-nowrap">
                    {row[c] == null ? (
                      <span className="text-muted-foreground">NaN</span>
                    ) : (
                      String(row[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
