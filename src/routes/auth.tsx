import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthSearch = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s) => AuthSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — Jim's Data Gym" },
      { name: "description", content: "Sign in with Google to start practicing." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: redirect ?? "/dashboard", replace: true });
      }
    });
  }, [navigate, redirect]);

  async function signInGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + (redirect ?? "/dashboard"),
      });
      if (result.error) {
        toast.error("Sign in failed: " + (result.error.message ?? "unknown error"));
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: redirect ?? "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Sign in failed");
      setBusy(false);
    }
  }

  async function signInDev() {
    setBusy(true);
    const email = "dev@jims-data-gym.local";
    const password = "devmode-password-123";
    try {
      let { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: "Dev User" } },
        });
        if (signUpErr && !/registered/i.test(signUpErr.message)) {
          throw signUpErr;
        }
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (retry.error) throw retry.error;
      }
      toast.success("Signed in as dev user");
      navigate({ to: redirect ?? "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Dev sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <h1 className="font-display text-3xl tracking-tight">Open the gym</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your Google account. We use it only to save your reps and email your
            spaced-repetition reminders.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full gap-3"
            onClick={signInGoogle}
            disabled={busy}
          >
            <GoogleIcon />
            {busy ? "Opening Google…" : "Continue with Google"}
          </Button>
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="lg"
              className="mt-3 w-full"
              onClick={signInDev}
              disabled={busy}
            >
              🛠 Dev mode: skip OAuth
            </Button>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            By continuing you agree to receive your own practice reminders. Cadence is editable in
            settings.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">← Back to home</a>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
