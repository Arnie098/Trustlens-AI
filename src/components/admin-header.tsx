import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, Shield, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { supabase } from "@/lib/db";

/** Dedicated chrome for the admin console (separate from the user SiteHeader). */
export function AdminHeader() {
  const { profile, user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-navy text-navy-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/admin" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-navy-foreground/40">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base font-semibold leading-tight tracking-tight">
              TrustLens Admin
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-navy-foreground/70 sm:block">
              Governance console
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <AdminNav to="/admin" icon={LayoutDashboard}>
            Overview
          </AdminNav>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="text-right text-xs">
            <div className="font-medium">{profile?.full_name ?? user?.email ?? "Admin"}</div>
            <div className="text-navy-foreground/60">{user?.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <button
          className="rounded-md p-2 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-foreground/15 bg-navy md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 p-3">
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-navy-foreground/10"
            >
              <LayoutDashboard className="h-4 w-4" /> Overview
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-navy-foreground/30 bg-transparent text-navy-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function AdminNav({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-foreground/80 transition-colors hover:bg-navy-foreground/10 hover:text-navy-foreground"
      activeProps={{ className: "bg-navy-foreground/15 !text-navy-foreground" }}
      activeOptions={{ exact: true }}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
