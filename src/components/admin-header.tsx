import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, Shield, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
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
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-brand-navy text-brand-navy-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo
          to="/admin"
          inverted
          title="VeriSphere AI Admin"
          subtitle="Governance console"
          size="md"
        />

        <nav className="hidden items-center gap-1 md:flex">
          <AdminNav to="/admin" icon={LayoutDashboard}>
            Overview
          </AdminNav>
          <a
            href="#users"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-navy-foreground/80 transition-colors hover:bg-white/10 hover:text-brand-navy-foreground"
          >
            <LayoutDashboard className="h-4 w-4" /> Users
          </a>
          <a
            href="#moderation"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-navy-foreground/80 transition-colors hover:bg-white/10 hover:text-brand-navy-foreground"
          >
            <Shield className="h-4 w-4" /> Moderation
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="text-right text-xs text-brand-navy-foreground">
            <div className="font-medium">{profile?.full_name ?? user?.email ?? "Admin"}</div>
            <div className="text-brand-navy-foreground/65">{user?.email}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 bg-transparent text-brand-navy-foreground hover:bg-white/10 hover:text-brand-navy-foreground"
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
        <div className="border-t border-white/10 bg-brand-navy md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 p-3 text-brand-navy-foreground">
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10"
            >
              <LayoutDashboard className="h-4 w-4" /> Overview
            </Link>
            <a
              href="#users"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10"
            >
              Users
            </a>
            <a
              href="#moderation"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10"
            >
              <Shield className="h-4 w-4" /> Moderation
            </a>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 border-white/30 bg-transparent text-brand-navy-foreground"
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
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-navy-foreground/80 transition-colors hover:bg-white/10 hover:text-brand-navy-foreground"
      activeProps={{ className: "bg-white/15 !text-brand-navy-foreground" }}
      activeOptions={{ exact: true }}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
