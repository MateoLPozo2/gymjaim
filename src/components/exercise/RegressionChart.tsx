import { getColumn, ParsedCsv } from "@/lib/csv";
import type { MissingPlan, SlopesResult } from "@/lib/exercise/types";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export function RegressionChart({
  plan,
  exercise,
  slopes,
}: {
  plan: MissingPlan;
  exercise: { target_col: string; y_col: string };
  slopes: SlopesResult;
}) {
  const xs = getColumn(plan.cleanCsv, exercise.target_col).filter(
    (v): v is number => v !== null,
  );
  const ys = getColumn(plan.cleanCsv, exercise.y_col).filter(
    (v): v is number => v !== null,
  );
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const lineData = [xMin, xMax].map((x) => ({
    x,
    expected: slopes.expected * x + slopes.intercept.exp,
    user: slopes.user * x + slopes.intercept.user,
  }));
  const scatter = xs
    .slice(0, 100)
    .map((x, i) => ({ x, y: ys[i] }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          dataKey="x"
          domain={["dataMin", "dataMax"]}
          tick={{ fontSize: 11 }}
          label={{
            value: exercise.target_col,
            position: "insideBottom",
            offset: -2,
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          tick={{ fontSize: 11 }}
          label={{
            value: exercise.y_col,
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
          }}
        />
        <ZAxis range={[20, 20]} />
        <Tooltip />
        <Scatter data={scatter} fill="oklch(0.5 0.04 250 / 0.6)" />
        <Line
          data={lineData}
          dataKey="expected"
          stroke="oklch(0.22 0.04 250)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Truth"
        />
        <Line
          data={lineData}
          dataKey="user"
          stroke="oklch(0.68 0.13 60)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
          name="Yours"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
