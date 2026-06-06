
# GymJaim — Practice Gym for Data Inference Judgment

A reps-based gym for junior data scientists to sharpen their inference and missing-value judgment in a controlled, supportive environment. Real pandas runs in the browser via Pyodide; spaced-repetition emails pull learners back to revisit and level up exercises they've already tried.

## Positioning (per hackathon guide)

- **Buyer**: junior data scientists (0–3 yrs), and the senior ICs / team leads who want to onboard them.
- **Status quo it replaces**: scattered, unsupervised self-practice — running notebooks alone with no signal that your imputation actually helped or hurt the answer.
- **Wedge**: every attempt is auto-graded against an oracle (the true regression slope from the un-deleted data), and a spaced-repetition email loop pulls you back to retry the same exercise 2 / 7 / 21 days later — so you practice the *judgment*, not just the syntax.
- **Why now**: Pyodide makes running pandas in-browser viable in 2026, so we can grade real code with zero backend per-user compute.
- **Weakest point (named honestly on the about page)**: oracle scoring only works for problems with a known ground truth — that limits us to teaching-dataset-style exercises, not open-ended real-world work. The bet is that *judgment training* is exactly what's missing for juniors.

## Routes

Public:
- `/` — landing: hero, "the problem", "how the gym works" (3 reps), live mini-exercise preview embedded, founder/edge section, CTA.
- `/auth` — Google sign-in.
- `/exercises/$id` (public-readable for shareability of public exercises; CTA to sign in to attempt).

Authenticated (`_authenticated/`):
- `/dashboard` — streak, recent attempts, suggested next exercise, due-for-review list (spaced-rep queue).
- `/exercises` — browse: tabs for *Public Library*, *Mine*, *Due for review*. Filter by difficulty, dataset, author.
- `/exercises/$id/attempt` — the runner.
- `/exercises/new` — author flow.
- `/datasets` — bundled seaborn + community + my uploads.
- `/history` — full attempt log.
- `/settings` — email cadence toggles (default 2/7/21 days), unsubscribe.

## Exercise runner (Pyodide)

- Singleton Pyodide web worker, preloads `pandas`, `numpy`, `scikit-learn`. Boot UI shows progress.
- Dataset fetched as CSV from Supabase Storage (or static seaborn CSVs from `src/assets/datasets/`) into the worker DataFrame.
- Missing-value generation logic ported verbatim from the Streamlit script (Easy = MCAR, Medium = condition on another var, Hard = condition + quartile). Seed stored per attempt → Reset truly restores the same starting state, and email follow-ups load the same seed.
- Monaco editor (python). Execute captures stdout + last-expression; DataFrames render as tables, scalars as code blocks (mirrors the Streamlit UX).
- Metrics row: Expected slope, Your slope, Δ, % change, Optimal-oracle slope. Green check when user matches the oracle.
- Recharts plot: original regression line, user regression line, 100-point scatter of consistent indices.

## Spaced-repetition email loop

- After each attempt insert review rows scheduled at now+2d, +7d, +21d into `review_queue` (skips if user disabled cadence).
- pg_cron job every 10 minutes calls `/api/public/cron/send-due-reviews` (HMAC-verified). The route reads due rows, renders a React-Email template ("Come back for another rep: <exercise title>"), and sends through Lovable Emails (the built-in email infrastructure — `email_domain--setup_email_infra` + `email_domain--scaffold_transactional_email`).
- Email = exercise title + one-line difficulty/dataset + "Take another rep" button → deep link `/_authenticated/exercises/$id/attempt?seed=<same-seed>`. Same seed = comparable score, so the user can see if their judgment improved.
- Suppressed/unsubscribed addresses honored automatically by the scaffold.

## Datasets

- Bundle seaborn samples (`tips`, `penguins`, `mpg`, `exercise`, `car_crashes`, `planets`, `healthexp`) as static CSVs in `src/assets/datasets/`.
- User uploads (≤5MB CSV) → Supabase Storage; metadata row in `datasets`. `is_public` flag opens it to the community library.

## Auth

- Lovable Cloud + Google OAuth via the Lovable broker (`lovable.auth.signInWithOAuth("google")`). Configure provider with `supabase--configure_social_auth`.
- Managed `_authenticated/` layout (no custom gate).
- Sign-out follows the cache-teardown hygiene (`cancelQueries` → `clear` → `signOut` → `replace`-navigate to `/auth`).

## Data model (Lovable Cloud)

- `profiles` (id → auth.users, display_name, avatar_url, email_cadence_enabled bool default true) + auto-create trigger.
- `datasets` (id, owner_id nullable, name, description, storage_path nullable, builtin_key nullable, columns jsonb, is_public, is_builtin, created_at).
- `exercises` (id, author_id, title, description, dataset_id, target_col, y_col, condition_col nullable, difficulty enum, visibility ['public','private'], created_at).
- `attempts` (id, user_id, exercise_id, seed bigint, code text, user_slope, expected_slope, optimal_slope, slope_delta, matched_oracle bool, created_at).
- `review_queue` (id, user_id, exercise_id, seed, due_at timestamptz, sent_at timestamptz nullable).
- RLS: owner-scoped CRUD; public-or-own read on exercises/datasets; attempts/queue private. Explicit `GRANT`s per template rules.
- Storage bucket `datasets` with owner-folder insert + signed-URL reads via server fn.

## Server functions

`requireSupabaseAuth`-protected: `listExercises({scope})`, `getExercise(id)`, `createExercise`, `updateExercise`, `deleteExercise`, `createDatasetFromUpload`, `toggleDatasetPublic`, `recordAttempt` (also enqueues review rows), `listAttempts`, `listDueReviews`, `updateEmailCadence`.

Server route (`/api/public/cron/send-due-reviews`, HMAC-verified): drains due review rows, sends via Lovable Emails, marks `sent_at`.

## Design direction

Editorial / warm-academic — drawn from the Bayes Law logo's beige curve plot. Off-white background, deep ink navy, single muted ochre accent. Serif display (Fraunces) for headings + Inter body. Restrained motion. Logo wired as an inline SVG component in the header. Charts use the same ochre + navy palette so dashboard visuals feel of-a-piece with the brand mark.

## Build order

1. Enable Lovable Cloud + Google auth (configure provider) + email domain + `setup_email_infra`.
2. Schema migration + RLS + storage bucket.
3. Landing page (with founder/edge block) + logo asset + `/auth` screen.
4. Authenticated shell + dashboard.
5. Pyodide worker + runner on one hardcoded exercise.
6. Exercise library + detail + attempts persistence + history.
7. Dataset upload + community sharing.
8. Exercise authoring flow.
9. App emails: `scaffold_transactional_email`, "review reminder" template, `review_queue` insert on attempt, public cron route, pg_cron job.
10. Settings page (cadence toggle, unsubscribe link wiring) + polish + empty/error/notfound states.

## Open defaults (call out, not blocking)

- Landing page will ship without an evidence quote (you didn't have one); I'll leave a clearly-marked placeholder block you can swap once you have a user quote.
- Code editor: Monaco python, no LSP.
- CSV upload cap: 5 MB.
- Score surfaced as |Δ slope| + % change + green check on oracle match (mirrors the Streamlit app).
- Default spaced-repetition cadence: 2 / 7 / 21 days, user-overridable later in `/settings`.
