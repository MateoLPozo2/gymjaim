import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getExercise } from "@/lib/api/exercises.functions";
import { ExerciseRunner } from "@/components/exercise/ExerciseRunner";

const RunnerSearch = z.object({ seed: z.string().optional() });

export const Route = createFileRoute("/_authenticated/exercises/$id")({
  validateSearch: (s) => RunnerSearch.parse(s),
  head: () => ({ meta: [{ title: "Take a rep — Jim's Data Gym" }] }),
  component: RunnerPage,
});

function RunnerPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const getEx = useServerFn(getExercise);

  const exQuery = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => getEx({ data: { id } }),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        to="/exercises"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      {exQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading exercise…</p>
      ) : exQuery.error ? (
        <p className="mt-6 text-destructive">{(exQuery.error as Error).message}</p>
      ) : (
        <ExerciseRunner
          exercise={(exQuery.data as any).exercise}
          datasetUrl={(exQuery.data as any).datasetCsvUrl}
          initialSeed={search.seed ? Number(search.seed) : undefined}
          onRecorded={() => {
            qc.invalidateQueries({ queryKey: ["attempts"] });
            qc.invalidateQueries({ queryKey: ["reviews-due"] });
          }}
        />
      )}
    </div>
  );
}
