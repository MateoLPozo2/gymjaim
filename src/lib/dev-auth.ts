// Dev-only local session bypass. NEVER trust this on the server.
// The flag lives in localStorage; protected server fns will still 401,
// so dev mode = browse the UI shell only.

const FLAG_KEY = "lovable-dev-mode";

export const DEV_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@local",
  user_metadata: { full_name: "Dev User" },
} as const;

export function isDevModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FLAG_KEY) === "1";
}

export function enableDevSession() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FLAG_KEY, "1");
}

export function disableDevSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FLAG_KEY);
}
