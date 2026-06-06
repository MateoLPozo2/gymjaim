/**
 * GymJaim feature stress test — pure logic + env checks.
 * Run: node scripts/stress-test.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const failures = [];
const passes = [];

function pass(name, detail = "") {
  passes.push({ name, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  failures.push({ name, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

function assert(name, cond, detail = "assertion failed") {
  if (cond) pass(name);
  else fail(name, detail);
}

// --- Dynamic import TS modules via tsx if available, else inline reimplementations ---
// We'll test by reading CSV files and running logic copied inline for zero-dep execution.

// --- CSV parser (mirror of src/lib/csv.ts) ---
function parseCsv(text) {
  const lines = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        field = "";
        if (cur.length > 1 || cur[0] !== "") lines.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length) {
    cur.push(field);
    lines.push(cur);
  }
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0];
  const rows = lines.slice(1).map((cells) =>
    cells.map((cell) => {
      if (cell === "" || cell === "NA" || cell === "NaN") return null;
      const n = Number(cell);
      return Number.isFinite(n) && cell.trim() !== "" ? n : cell;
    }),
  );
  return { columns, rows };
}

function getColumn(csv, name) {
  const i = csv.columns.indexOf(name);
  if (i === -1) return [];
  return csv.rows.map((r) => (typeof r[i] === "number" ? r[i] : null));
}

function dropMissingRows(csv, cols) {
  const idxs = cols.map((c) => csv.columns.indexOf(c));
  const rows = csv.rows.filter((r) => idxs.every((i) => r[i] !== null));
  return { columns: csv.columns, rows };
}

function ordinaryLeastSquares(x, y) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < x.length; i++) {
    const xv = x[i];
    const yv = y[i];
    if (xv == null || yv == null || !Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    xs.push(xv);
    ys.push(yv);
  }
  const n = xs.length;
  if (n < 2) return { slope: NaN, intercept: NaN, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return { slope: NaN, intercept: NaN, n };
  const slope = num / den;
  return { slope, intercept: my - slope * mx, n };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sampleWithoutReplacement(arr, n, rand) {
  const copy = arr.slice();
  shuffleInPlace(copy, rand);
  return copy.slice(0, Math.min(n, copy.length));
}

function quantile(values, q) {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function mean(values) {
  if (!values.length) return NaN;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function buildPlan(csv, targetCol, yCol, conditionCol, difficulty, seed) {
  const rand = mulberry32(seed);
  const baseCols = [targetCol, yCol, ...(conditionCol ? [conditionCol] : [])];
  const cleanCsv = dropMissingRows(csv, baseCols);
  const working = {
    columns: cleanCsv.columns,
    rows: cleanCsv.rows.map((r) => r.slice()),
  };
  const targetIdx = cleanCsv.columns.indexOf(targetCol);
  const allIdx = cleanCsv.rows.map((_, i) => i);
  const condCol =
    conditionCol && conditionCol !== targetCol
      ? conditionCol
      : cleanCsv.columns.find((c) => c !== targetCol && c !== yCol) ?? targetCol;
  const condValuesRaw = getColumn(cleanCsv, condCol).filter((v) => v !== null);
  const conditionValue = mean(condValuesRaw);
  const conditionOp = rand() < 0.5 ? ">" : "<";
  const hardQuartile = rand() < 0.5 ? "top" : "bottom";
  let eligible = allIdx;
  if (difficulty !== "easy") {
    const condIdx = cleanCsv.columns.indexOf(condCol);
    eligible = allIdx.filter((i) => {
      const v = cleanCsv.rows[i][condIdx];
      if (typeof v !== "number") return false;
      return conditionOp === ">" ? v > conditionValue : v < conditionValue;
    });
  }
  if (difficulty === "hard") {
    const targetValues = getColumn(cleanCsv, targetCol).filter((v) => v !== null);
    const threshold = quantile(targetValues, hardQuartile === "top" ? 0.75 : 0.25);
    eligible = eligible.filter((i) => {
      const v = cleanCsv.rows[i][targetIdx];
      if (typeof v !== "number") return false;
      return hardQuartile === "top" ? v >= threshold : v <= threshold;
    });
  }
  const pct = 0.1 + rand() * 0.2;
  const n = Math.max(1, Math.floor(eligible.length * pct));
  const deletedIndices = sampleWithoutReplacement(eligible, n, rand);
  for (const i of deletedIndices) working.rows[i][targetIdx] = null;
  return { cleanCsv, workingCsv: working, deletedIndices, conditionOp, conditionValue, hardQuartile };
}

console.log("\n=== GymJaim Stress Test ===\n");

// 1. Built-in datasets
console.log("1. Built-in datasets");
const BUILTIN_KEYS = ["tips", "penguins", "mpg", "exercise", "car_crashes", "planets", "healthexp"];
for (const key of BUILTIN_KEYS) {
  const path = join(ROOT, "src/assets/datasets", `${key}.csv`);
  if (!existsSync(path)) {
    fail(`builtin:${key}`, `missing file ${path}`);
    continue;
  }
  const text = readFileSync(path, "utf8");
  const parsed = parseCsv(text);
  assert(
    `builtin:${key}:parse`,
    parsed.columns.length >= 2 && parsed.rows.length >= 10,
    `only ${parsed.columns.length} cols, ${parsed.rows.length} rows`,
  );
}

// 2. CSV edge cases
console.log("\n2. CSV parser edge cases");
{
  const quoted = parseCsv('a,b\n"hello, world",1\n2,3');
  assert("csv:quoted-fields", quoted.rows[0][0] === "hello, world");
  const empty = parseCsv("");
  assert("csv:empty", empty.columns.length === 0 && empty.rows.length === 0);
  const na = parseCsv("x\nNA\n1");
  assert("csv:na-null", na.rows[0][0] === null && na.rows[1][0] === 1);
}

// 3. OLS stats
console.log("\n3. Statistics (OLS)");
{
  const r = ordinaryLeastSquares([1, 2, 3, 4], [2, 4, 6, 8]);
  assert("ols:perfect-line", Math.abs(r.slope - 2) < 1e-10, `slope=${r.slope}`);
  const r2 = ordinaryLeastSquares([1, null, 3], [2, 4, 6]);
  assert("ols:skips-nulls", r2.n === 2);
  const r3 = ordinaryLeastSquares([1, 1, 1], [1, 2, 3]);
  assert("ols:zero-denominator", Number.isNaN(r3.slope));
}

// 4. Missing-value plan determinism
console.log("\n4. Missing-value generation");
{
  const tips = parseCsv(readFileSync(join(ROOT, "src/assets/datasets/tips.csv"), "utf8"));
  const p1 = buildPlan(tips, "tip", "total_bill", null, "easy", 42);
  const p2 = buildPlan(tips, "tip", "total_bill", null, "easy", 42);
  assert(
    "missing:seed-deterministic",
    JSON.stringify(p1.deletedIndices) === JSON.stringify(p2.deletedIndices),
  );
  assert("missing:deletes-values", p1.deletedIndices.length >= 1);
  const nullCount = getColumn(p1.workingCsv, "tip").filter((v) => v === null).length;
  assert("missing:nulls-in-target", nullCount === p1.deletedIndices.length);

  for (const diff of ["easy", "medium", "hard"]) {
    const p = buildPlan(tips, "tip", "total_bill", "size", diff, 12345);
    assert(`missing:${diff}:runs`, p.deletedIndices.length >= 1);
  }
}

// 5. Imputation grading simulation
console.log("\n5. Oracle grading simulation");
{
  const tips = parseCsv(readFileSync(join(ROOT, "src/assets/datasets/tips.csv"), "utf8"));
  const seed = 999;
  const plan = buildPlan(tips, "tip", "total_bill", null, "easy", seed);
  const exp = ordinaryLeastSquares(getColumn(plan.cleanCsv, "tip"), getColumn(plan.cleanCsv, "total_bill"));

  // Mean imputation should often be close
  const targetIdx = plan.workingCsv.columns.indexOf("tip");
  const imputed = plan.workingCsv.rows.map((r) => r.slice());
  const meanTip = mean(getColumn(plan.cleanCsv, "tip").filter((v) => v !== null));
  for (const i of plan.deletedIndices) imputed[i][targetIdx] = meanTip;
  const userSlope = ordinaryLeastSquares(
    imputed.map((r) => r[targetIdx]),
    imputed.map((r) => r[plan.workingCsv.columns.indexOf("total_bill")]),
  );
  assert("grading:mean-impute-finite", Number.isFinite(userSlope.slope));
  assert("grading:expected-finite", Number.isFinite(exp.slope));
}

// 6. Environment variables
console.log("\n6. Environment / infra");
{
  const envPath = join(ROOT, ".env");
  const envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const envKeys = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  for (const k of envKeys) {
    const inEnv = envText.includes(k + "=") && !envText.match(new RegExp(`${k}=\\s*$`, "m"));
    const inProcess = !!process.env[k];
    if (inEnv || inProcess) pass(`env:${k}`, "present");
    else fail(`env:${k}`, "missing — Supabase/auth features will fail locally");
  }
}

// 7. Route tree completeness
console.log("\n7. Route files exist");
const expectedRoutes = [
  "src/routes/index.tsx",
  "src/routes/auth.tsx",
  "src/routes/_authenticated/dashboard.tsx",
  "src/routes/_authenticated/exercises.index.tsx",
  "src/routes/_authenticated/exercises.$id.tsx",
  "src/routes/_authenticated/exercises.new.tsx",
  "src/routes/_authenticated/datasets.tsx",
  "src/routes/_authenticated/history.tsx",
  "src/routes/_authenticated/settings.tsx",
  "src/routes/api/public/cron/send-due-reviews.ts",
];
for (const r of expectedRoutes) {
  assert(`route:${r}`, existsSync(join(ROOT, r)));
}

// 8. Plan vs implementation gaps
console.log("\n8. Plan vs implementation checks");
{
  // Plan says public /exercises/$id but route is under _authenticated
  const routeTree = readFileSync(join(ROOT, "src/routeTree.gen.ts"), "utf8");
  const hasPublicExercise =
    routeTree.includes('path: "/exercises/$id"') && !routeTree.includes("/_authenticated/exercises/$id");
  if (hasPublicExercise) pass("plan:public-exercise-route");
  else fail("plan:public-exercise-route", "Plan specifies public /exercises/$id for shareability; only authenticated route exists");

  // Plan says /exercises/$id/attempt but actual is /exercises/$id
  if (routeTree.includes("/exercises/$id/attempt")) pass("plan:attempt-subroute");
  else fail("plan:attempt-subroute", "Plan specifies /exercises/$id/attempt; runner lives at /exercises/$id (minor URL mismatch)");

  // HMAC verification on cron route
  const cronSrc = readFileSync(join(ROOT, "src/routes/api/public/cron/send-due-reviews.ts"), "utf8");
  if (cronSrc.includes("HMAC") || cronSrc.includes("hmac") || cronSrc.includes("verify"))
    pass("plan:cron-hmac");
  else fail("plan:cron-hmac", "Plan says HMAC-verified cron; route has no auth/HMAC check — publicly callable");

  // deleteExercise exists but no UI?
  const exNew = readFileSync(join(ROOT, "src/routes/_authenticated/exercises.index.tsx"), "utf8");
  if (exNew.includes("deleteExercise")) pass("feature:delete-exercise-ui");
  else fail("feature:delete-exercise-ui", "deleteExercise API exists but no UI to delete exercises");
}

// 9. Stress: all datasets × all difficulties
console.log("\n9. Cross-product stress (datasets × difficulties)");
for (const key of BUILTIN_KEYS) {
  const path = join(ROOT, "src/assets/datasets", `${key}.csv`);
  if (!existsSync(path)) continue;
  const parsed = parseCsv(readFileSync(path, "utf8"));
  const numericCols = parsed.columns.filter((c) => {
    const col = getColumn(parsed, c);
    return col.filter((v) => v !== null).length > parsed.rows.length * 0.5;
  });
  if (numericCols.length < 2) {
    fail(`stress:${key}:numeric-cols`, `only ${numericCols.length} numeric columns`);
    continue;
  }
  const target = numericCols[0];
  const y = numericCols[1];
  for (const diff of ["easy", "medium", "hard"]) {
    try {
      for (let seed = 1; seed <= 50; seed++) {
        const p = buildPlan(parsed, target, y, null, diff, seed * 1000 + seed);
        if (p.deletedIndices.length < 1) throw new Error("no deletions");
        const exp = ordinaryLeastSquares(getColumn(p.cleanCsv, target), getColumn(p.cleanCsv, y));
        if (!Number.isFinite(exp.slope) && p.cleanCsv.rows.length >= 2)
          throw new Error("expected slope NaN");
      }
      pass(`stress:${key}:${diff}`, "50 seeds OK");
    } catch (e) {
      fail(`stress:${key}:${diff}`, e.message);
    }
  }
}

console.log("\n=== Summary ===");
console.log(`Passed: ${passes.length}`);
console.log(`Failed: ${failures.length}`);
if (failures.length) {
  console.log("\n--- FAILURES ---");
  for (const f of failures) console.log(`  • ${f.name}: ${f.detail}`);
  process.exit(1);
}
console.log("\nAll checks passed.\n");
