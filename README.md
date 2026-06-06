# Jim's Data Gym

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
File-based routing via [TanStack Router](https://tanstack.com/router). Each `.tsx` file under `src/routes/` is a route. `routeTree.gen.ts` is auto-generated — do not edit it.

Layout: `__root.tsx` wraps all pages. `_authenticated/route.tsx` guards signed-in routes and renders `AppHeader`.

## Public routes

| URL | File | Purpose |
| --- | --- | --- |
| `/` | `index.tsx` | Landing page. Product overview and sign-in CTA. Redirects to `/dashboard` when already signed in. |
| `/auth` | `auth.tsx` | Google OAuth sign-in. Accepts `?redirect=` to return after login. |

## Authenticated routes

All paths below require sign-in. Unauthenticated users redirect to `/auth`.

| URL | File | Purpose |
| --- | --- | --- |
| `/dashboard` | `_authenticated/dashboard.tsx` | Home after sign-in. Weekly rep stats, oracle matches, reviews due, recent attempts, suggested exercises from the public library, link to create an exercise. |
| `/exercises` | `_authenticated/exercises.index.tsx` | Exercise hub. Tabs: **Public library**, **Mine**, **Due for review**. Each card opens the runner. |
| `/exercises/new` | `_authenticated/exercises.new.tsx` | Author a exercise: pick or upload a dataset, set columns, difficulty (easy / medium / hard), visibility, title. CSV upload with optional profiling preview. |
| `/exercises/:id` | `_authenticated/exercises.$id.tsx` | Exercise runner. Pyodide Python env, Monaco editor, dataset inspector, score vs. truth, sample solutions, save rep. Accepts `?seed=` for review revisits. |
| `/datasets` | `_authenticated/datasets.tsx` | Dataset catalog: built-in, public, and owned CSVs. Toggle public on owned uploads. Links to detail pages. |
| `/datasets/:id` | `_authenticated/datasets.$id.tsx` | Dataset detail: name, source blurb (built-ins), row/column counts, variable table (dtype, nulls, stats), 20-row preview. |
| `/history` | `_authenticated/history.tsx` | Rep history. Timestamped attempts with expected slope, yours, delta, optimal, oracle badge. |
| `/settings` | `_authenticated/settings.tsx` | Email review cadence, recipient addresses, scheduled review list, manual send/test triggers, voice coach toggle, owned datasets list. |

`_authenticated/exercises.tsx` is a layout route (`<Outlet />`) for `/exercises/*`.

## Exercise runner (mounted at `/exercises/:id`)

Implemented in `src/components/exercise/ExerciseRunner.tsx`, not in the route file itself.

| Function | Behavior |
| --- | --- |
| Python environment | Pyodide Web Worker loads pandas; `df` is the working dataset with injected NaNs. |
| Run / Reset | Execute editor code; reset restores starter code and original missing-value state for the seed. |
| Score vs. truth | Live grade: expected, user, and optimal regression slopes; delta; oracle match; chart overlay. |
| Voice coach | Optional (Settings). Briefing on load; spoken debrief after saving a rep. |
| Sample solutions | Collapsible cards — mean, median, regression, group fill — with **Load into editor**. |
| Save rep | Persists attempt + schedules review emails (+2 / +7 / +21 days). |

## Difficulty (missing-value injection)

| Level | Pattern |
| --- | --- |
| Easy | Missing completely at random |
| Medium | Missing conditional on another column |
| Hard | Conditional + restricted to top or bottom quartile of target |

Same `seed` always reproduces the same missing rows (used for Reset and review links).

## TanStack file conventions

| File pattern | URL |
| --- | --- |
| `index.tsx` | directory root (`/users` → `users/index.tsx`) |
| `$id.tsx` | dynamic segment (`/users/:id`) |
| `_layout.tsx` | layout with `<Outlet />` |
| `__root.tsx` | app shell |

Do not use Next.js patterns (`src/pages/`, `app/layout.tsx`).

