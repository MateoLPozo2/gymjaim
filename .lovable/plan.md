
## Goal
Bypass OAuth locally with a one-click "Dev Mode" button on `/auth`. No backend user — purely client-side fake session, only available in dev.

## Approach

### 1. Fake session helper — `src/lib/dev-auth.ts` (new)
- `DEV_USER` constant: `{ id: "dev-user-00000000-0000-0000-0000-000000000000", email: "dev@local", ... }`.
- `enableDevSession()`: writes a synthetic Supabase session object to `localStorage` under the supabase-js storage key (`sb-<project-ref>-auth-token`) so `supabase.auth.getUser()`/`getSession()` resolve to the fake user on the client.
- `isDevSession(user)`: checks the sentinel id.
- `disableDevSession()`: clears the key.

Since `getUser()` revalidates with the Auth server and would reject the fake token, we'll patch the managed `_authenticated/route.tsx` flow minimally — see step 3.

### 2. Dev button on `/auth`
- In `src/routes/auth.tsx`, render a `<Button variant="outline">Skip OAuth (Dev Mode)</Button>` only when `import.meta.env.DEV` is true.
- Click → `enableDevSession()` → `navigate({ to: "/dashboard" })`.

### 3. Auth gate tolerance for dev session
The managed `_authenticated/route.tsx` calls `supabase.auth.getUser()` and would reject the fake token. Since that file is integration-managed, instead:
- Add a tiny client-side check in a new `src/lib/dev-auth-guard.ts` that the dev button uses, AND
- Patch only the protected pages that call `requireSupabaseAuth` serverFns to short-circuit when a dev session is detected — i.e. wrap query calls to return mock data in dev mode.

**Simpler alternative (preferred):** the dev session is purely visual. Most protected pages already gracefully handle empty data. Server functions called with no valid bearer will 401; we'll catch those at the query level and return empty arrays when `isDevSession()` is true. This means dev mode = browse the UI shell with empty state, no DB writes — which matches "local-only session is sufficient".

### 4. Sign-out
- Existing sign-out flow already clears localStorage; add `disableDevSession()` call to be safe.

## Out of scope
- Real user creation
- Persisting exercises/attempts in dev mode (server fns will 401; UI shows empty state)
- Production builds (button hidden via `import.meta.env.DEV`)

## Files
- **New:** `src/lib/dev-auth.ts`
- **Edited:** `src/routes/auth.tsx` (add button), and the QueryClient default error handler or per-query `onError` to swallow 401s silently when dev session is active
