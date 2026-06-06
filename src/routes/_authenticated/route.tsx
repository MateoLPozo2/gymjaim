import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }

    // Onboarding gate — don't loop on the welcome route itself.
    if (location.pathname !== "/welcome") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at,welcome_on_next_login")
        .eq("id", data.user.id)
        .maybeSingle();
      const needs =
        !profile?.onboarding_completed_at || !!profile?.welcome_on_next_login;
      if (needs) {
        throw redirect({ to: "/welcome" });
      }
    }

    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const isWelcome =
    typeof window !== "undefined" && window.location.pathname === "/welcome";
  if (isWelcome) {
    return <Outlet />;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
