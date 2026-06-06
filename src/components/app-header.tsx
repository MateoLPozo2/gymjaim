import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link to="/dashboard" className="shrink-0">
          <BrandLogo />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/exercises">Exercises</NavItem>
          <NavItem to="/datasets">Datasets</NavItem>
          <NavItem to="/history">History</NavItem>
          <NavItem to="/settings">Settings</NavItem>
        </nav>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      activeProps={{ className: "px-3 py-1.5 rounded-md text-foreground bg-secondary" }}
    >
      {children}
    </Link>
  );
}
