# Plan: Functional runner, solution cards, dataset detail view

## 1. Fix the exercise runner (Run / Reset)

The runner already wires `onRun` → `pyodide.exec(code)` and `onReset` → `pyodide.resetDataset(...)`, but it has two real bugs that make it feel broken:

- **Worker boot can hang silently on the Worker SSR runtime.** The worker uses `new URL("../lib/pyodide/worker.ts", import.meta.url)` which is fine in browser, but the route is wrapped in SSR. We'll guard the `usePyodide` effect with `typeof window !== "undefined"` and only construct the Worker in the browser.
- **Run button is gated on `pyodide.status === "loading"`** but `status` starts as `"idle"` before the effect runs, and after a successful `loadDataset` the status is `"dataset"` — Run already works there, but error states are swallowed. We'll:
  - Surface `pyodide.error` in the status pill.
  - Disable Run only when status is `idle | loading | error`.
  - Add a one-line "loaded N rows × M cols" confirmation under the editor once the dataset is in pandas.
- **Reset** currently calls `resetDataset` with the working CSV (the one with NaNs) — correct, but we also reset the editor's code back to the starter snippet so users can retry from scratch.

No backend changes needed for this section.

## 2. "Expected solutions" cards on the runner

Add a new collapsible section under the editor titled **"Peek at sample solutions"** with 3 cards (mean fill, median fill, conditional group fill). Each card shows:

- Short title + one-line description of the strategy
- Read-only Python snippet (using the exercise's `target_col`, `y_col`, `condition_col`)
- **"Load into editor"** button that copies the snippet into the Monaco editor

Snippets are generated client-side from the exercise's column metadata — no DB writes, no new server functions. Lives in a new `src/lib/exercise-solutions.ts` helper.

## 3. Dataset detail view

Currently `/datasets` is a flat list. We'll add:

- A new route `src/routes/_authenticated/datasets.$id.tsx` (URL `/datasets/$id`) that shows:
  - Dataset name, description, source, # rows, # columns
  - **Variables table**: column name, inferred dtype (number/string/bool), non-null count, sample values, min/max/mean for numerics
  - **Preview table**: first 20 rows
  - For built-in seaborn datasets: a short canned blurb (origin + typical use) hard-coded in `src/lib/datasets/builtin-meta.ts` — we won't call Kaggle at runtime (no API key, would also require server-side fetching). I'll note this in the UI and we can add Kaggle later if you provide an API key.
- A new server function `getDatasetDetail({ id })` in `src/lib/api/datasets.functions.ts` that returns the dataset row + a signed URL (for uploaded CSVs) so the page can parse columns/stats client-side using existing `parseCsv` + `src/lib/stats.ts`.
- Make each card on `/datasets` a `<Link to="/datasets/$id">`.

## 4. Out of scope (ask before doing)

- Live Kaggle metadata fetch (needs API key + server route).
- Persisting "viewed sample solution" as a hint penalty on attempts.
- Editor autocomplete for column names.

## Files

- edit `src/hooks/use-pyodide.ts` — SSR guard + expose error
- edit `src/routes/_authenticated/exercises.$id.tsx` — enable button logic, reset editor code, mount solution cards, dataset-loaded confirmation
- new `src/lib/exercise-solutions.ts` — snippet generator
- new `src/lib/datasets/builtin-meta.ts` — blurbs for 7 seaborn sets
- new `src/lib/api/datasets.functions.ts` — add `getDatasetDetail`
- new `src/routes/_authenticated/datasets.$id.tsx`
- edit `src/routes/_authenticated/datasets.tsx` — link cards to detail page

Confirm and I'll switch to build mode.