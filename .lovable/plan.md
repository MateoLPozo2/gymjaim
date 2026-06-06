# Onboarding Welcome Flow

A one-time, slide-animated welcome that appears on first sign-in, collects role + topic preferences, and recommends 3 exercises before the user lands on the dashboard.

## Behavior

1. User signs in → the `_authenticated` layout checks `profiles.onboarding_completed_at`.
2. If null, redirect to `/welcome`. Otherwise proceed to `/dashboard` (or wherever they navigated).
3. `/welcome` plays a 3-step slide-animated flow, then writes preferences + marks onboarding complete and redirects to the dashboard.
4. Subsequent sign-ins skip `/welcome` entirely. Reachable later only from Settings (“Re-run intro”) — out of scope for this round.

## Steps in the popup (one screen at a time, slide transition)

**Step 1 — Hello (Apple-style boot vibe)**

- Centered, soft fade + slow scale "Hello." in display type, followed by the user's first name if available.
- A subtle gradient/aurora background; respects `prefers-reduced-motion`.
- Auto-advance after ~2.5s or on click/Enter.
- Make sure to sue the same font that we have used on the website so far.

**Step 2 — Who are you? (role + goals)**

- Role dropdown (single select, required):
  - Data Analyst, Business Analyst, Junior Data Scientist, Research Analyst, Market Research Analyst, Operations Analyst, Product Analyst, Business Intelligence (BI) Analyst, Student, Other.
  - If "Other" → mandatory free-text "Your role" field appears.
- Goals: one short textarea, max 280 chars, optional.
- Continue button disabled until role (and custom role text if Other) is filled.

**Step 3 — What do you want to practice?**

- Multi-select of curriculum subtopics, grouped by category, min 1 required:
  - Introduction: Data Types, Descriptive Statistics, Data Formats, Probability Distributions, Sample vs. Population, Data Storage and Imports
  - Data Cleaning: Type Errors and Duplicate Values, Missing Values, Outlier Detection, Cleaning Strings, Data Transformation, Encoding Categorical Variables, Feature Selection
  - Forecasting: Autoregressive Models, Moving Average Models, Exponential Smoothing, ARIMA Models, ARCH Models, Lag Length Selection, Seasonality, State-space Models, Forecast Evaluation
  - Machine Learning: shown as a disabled "coming soon" group.
- Submit → save preferences, compute 3 suggestions, advance.

**Step 4 — Your starter set**

- Show exactly 3 suggested exercises as cards (title, topic, difficulty badge), animated in sequentially.
- Primary CTA "Start now" → opens the first exercise. Secondary "Go to dashboard" → `/dashboard`. Either way, onboarding is marked complete.

## Suggestion logic (Filter + difficulty ramp)

- Pull from `exercises` filtered by `topic IN (selected_subtopics)`.
- Order by difficulty asc (easy → medium → hard). If `exercises.difficulty` isn't already present, fall back to `created_at` asc and note this as a follow-up.
- Pick 3: 1 easy, 1 medium, 1 hard when available; otherwise fill the gaps with the next-easiest remaining.
- If fewer than 3 match, top up with the closest exercises from selected categories.
- Cap to 3, no duplicates.

## Data model

New columns on `profiles` (migration):

- `onboarding_completed_at timestamptz null`
- `role text null`
- `role_custom text null`
- `goals text null`
- `preferred_topics text[] not null default '{}'`

No new table needed. RLS: existing self-row policies on `profiles` cover read/update.

## Technical layout

- Route: `src/routes/_authenticated/welcome.tsx` (full-screen, no app shell).
- Gate: in the existing `_authenticated/route.tsx` (or sibling guard) compare `onboarding_completed_at` and `redirect({ to: "/welcome" })` when null and current path isn't `/welcome`.
- Server functions in `src/lib/onboarding.functions.ts`:
  - `getOnboardingStatus` — returns `{ completed, profile }`.
  - `saveOnboarding` — validates with zod, writes role/role_custom/goals/preferred_topics, sets `onboarding_completed_at = now()`.
  - `getStarterSuggestions` — takes selected topics, returns 3 exercises using the ramp logic above.
- Components in `src/components/onboarding/`: `WelcomeHello.tsx`, `RoleStep.tsx`, `TopicsStep.tsx`, `SuggestionsStep.tsx`, `OnboardingShell.tsx` (handles slide transitions with framer-motion).
- Curriculum constant in `src/lib/onboarding/curriculum.ts` (single source of truth for the grouped topic list).
- Dev-mode sign-in: ensure the dev user's profile starts with `onboarding_completed_at = null` so the flow is testable; add a "Reset onboarding" button on Settings (small, dev-only acceptable) — optional.

Additional Addition  
One should be able to toggle the welcome page on the setting sfunction to be prompted for the welcome page.   
  
Out of scope (call out)

- Editing preferences later from Settings UI (data is saved; UI can come next).
- Re-suggesting exercises on later visits (this round only suggests once).
- Difficulty column backfill: if `exercises.difficulty` is missing, suggestions degrade to `created_at` ordering until that's added.