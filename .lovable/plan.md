## Bug
Top nav (`AppHeader`) disappears after leaving `/welcome` (either first sign-in or the Settings re-trigger). Navigating to `/dashboard` (or anywhere else under `_authenticated`) shows the page content with no header above it.

## Root cause
`src/routes/_authenticated/route.tsx` decides whether to render `AppHeader` using a one-shot read of `window.location.pathname` at component render time:

```tsx
const isWelcome = typeof window !== "undefined" && window.location.pathname === "/welcome";
if (isWelcome) return <Outlet />;
```

This value is not reactive. The layout component mounts once for the whole `_authenticated` subtree; when the welcome flow SPA-navigates to `/dashboard`, the layout does not re-render with the new pathname, so it keeps returning the headerless branch.

## Fix
Stop branching the layout. The welcome page already renders as a `fixed inset-0 z-50` full-screen overlay, so it naturally covers `AppHeader` while it's active — no special-casing needed in the layout.

### Change
In `src/routes/_authenticated/route.tsx`:
- Remove the `isWelcome` check and the early `<Outlet />` return.
- Always render the `AppHeader` + `<main><Outlet /></main>` shell.

Result:
- On `/welcome`, the overlay still covers the screen; user sees the welcome flow exactly as today.
- After completing onboarding (first time or Settings re-trigger), the navigation to `/dashboard` reveals the existing `AppHeader` correctly because it was always mounted.

## Out of scope
- No changes to the welcome flow itself, onboarding server functions, or the dashboard.
- No changes to the auth/onboarding gate logic in `beforeLoad`.
