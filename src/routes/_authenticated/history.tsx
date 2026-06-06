import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAttempts } from "@/lib/api/attempts.functions";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Jim's Data Gym" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const fn = useServerFn(listAttempts);
  const q = useQuery({ queryKey: ["attempts-full"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">Your rep history</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every attempt, oldest at the bottom. Δ is your slope minus the truth slope.
      </p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-display text-lg">Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (q.data?.attempts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reps yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2">When</th>
                  <th className="py-2">Expected</th>
                  <th className="py-2">Yours</th>
                  <th className="py-2">Δ</th>
                  <th className="py-2">Optimal</th>
                  <th className="py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(q.data?.attempts ?? []).map((a: any) => (
                  <tr key={a.id} className="border-t border-border/60">
                    <td className="py-2 text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">{a.expected_slope?.toFixed(3) ?? "—"}</td>
                    <td className="py-2">{a.user_slope?.toFixed(3) ?? "—"}</td>
                    <td className="py-2">
                      {a.slope_delta == null
                        ? "—"
                        : (a.slope_delta > 0 ? "+" : "") + a.slope_delta.toFixed(3)}
                    </td>
                    <td className="py-2">{a.optimal_slope?.toFixed(3) ?? "—"}</td>
                    <td className="py-2 text-right">
                      {a.matched_oracle && (
                        <Badge variant="outline" className="border-success text-success">
                          oracle
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
