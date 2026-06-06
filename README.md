# Jim's Data Gym (GymJaim)

Practice service for early-career data scientists and anyone learning data analysis through hands-on exercises. Each exercise drops missing values into a real dataset; you impute with pandas, get scored against ground truth, and revisit the same problem on a schedule.

## What you can do

**Sign in and dashboard**
- Google OAuth sign-in (`/auth`)
- Dashboard with weekly rep count, oracle matches, reviews due, recent attempts, and suggested exercises from the public library

**Exercises**
- Browse public exercises, your own, or those due for review (`/exercises`)
- Three difficulty levels: easy, medium, hard
- In-browser Python via Pyodide — Monaco editor, Run / Reset, optional JS fallback
- Sample solutions (mean, median, regression, group fill) loadable into the editor
- Score vs. truth: expected slope, your slope, delta value (Δ), optimal oracle slope, regression chart
- Save a completed attempt as a **rep** — code, slopes, and oracle match are persisted

**Datasets**
- List view with public toggle for owned datasets (`/datasets`)
- Detail view: column stats, dtype inference, preview rows, source metadata (`/datasets/:id`)
- Upload CSV when creating a new exercise (max 5 MB; optional FastAPI profiler)

**Authoring**
- Create exercises from an existing or newly uploaded dataset (`/exercises/new`)
- Set target column, regression `y` column, optional condition column, difficulty, visibility

**History and spaced repetition**
- Full attempt log with timestamps and slope scores (`/history`)
- Saving a rep schedules email reviews at +2, +7, and +21 days (same exercise, same seed)
- Configure email cadence, and recipients in Settings (`/settings`)

## How scoring works

1. Missing values are injected from a deterministic seed (Reset and review links use the same data).
2. You run pandas code to impute the target column.
3. The app compares OLS slopes for `target_col ~ y_col` on clean vs. imputed data.
4. Feedback shows expected, yours, optimal, and whether you matched the oracle strategy.

## Setup

```bash
npm install   # copies Pyodide to public/pyodide/
npm run dev
```

**Required env** (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, and server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Apply Supabase migrations in `supabase/migrations/`, then enable Google OAuth in Supabase.

```bash
cd services/dataset-api && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Routes

See [`src/routes/README.md`](src/routes/README.md) for the full route map and what each page implements.
