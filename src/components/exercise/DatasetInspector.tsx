import { ParsedCsv } from "@/lib/csv";
import { missingInColumn } from "@/lib/exercise/preview";
import type { MissingPlan } from "@/lib/exercise/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { CsvPreviewTable } from "./CsvPreviewTable";

interface DatasetInspectorProps {
  plan: MissingPlan;
  workingCsv: ParsedCsv;
  targetCol: string;
  yCol: string;
  conditionCol?: string | null;
  datasetId?: string;
}

export function DatasetInspector({
  plan,
  workingCsv,
  targetCol,
  yCol,
  conditionCol,
  datasetId,
}: DatasetInspectorProps) {
  const missingCount = missingInColumn(workingCsv, targetCol);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-lg">Dataset</CardTitle>
            <CardDescription>
              {missingCount} value{missingCount === 1 ? "" : "s"} missing from{" "}
              <code>{targetCol}</code>
            </CardDescription>
          </div>
          {datasetId && (
            <Link
              to="/datasets/$id"
              params={{ id: datasetId }}
              className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              View full dataset →
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {workingCsv.columns.map((c) => {
            const role =
              c === targetCol
                ? "target"
                : c === yCol
                  ? "y"
                  : c === conditionCol
                    ? "condition"
                    : null;
            return (
              <Badge
                key={c}
                variant={role ? "default" : "outline"}
                className="font-mono text-[10px]"
              >
                {c}
                {role === "target" && " · target"}
                {role === "y" && " · y"}
                {role === "condition" && " · condition"}
              </Badge>
            );
          })}
        </div>

        <Tabs defaultValue="working">
          <TabsList className="h-8">
            <TabsTrigger value="working" className="text-xs">
              Working (with NaNs)
            </TabsTrigger>
            <TabsTrigger value="clean" className="text-xs">
              Clean (ground truth)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="working" className="mt-2">
            <CsvPreviewTable csv={workingCsv} maxRows={10} highlightCol={targetCol} />
          </TabsContent>
          <TabsContent value="clean" className="mt-2">
            <CsvPreviewTable csv={plan.cleanCsv} maxRows={10} highlightCol={targetCol} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
