import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { useSession } from "@/lib/auth/session";
import { supabase } from "@/lib/db";

export function SiteHeader() {
  const { user, isAdmin } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo
          to="/"
          subtitle="Think before you trust"
          size="md"
        />

        <nav className="hidden items-center gap-1 md:flex">
          <NavItem to="/">Home</NavItem>
          {user && !isAdmin && <NavItem to="/dashboard">Dashboard</NavItem>}
          {user && !isAdmin && <NavItem to="/verify">Verify</NavItem>}
          {!user && <NavItem to="/auth">Verify</NavItem>}
          {user && !isAdmin && <NavItem to="/learn">Learn</NavItem>}
          {!user && <NavItem to="/auth">Learn</NavItem>}
          {user && !isAdmin && <NavItem to="/achievements">Achievements</NavItem>}
          <NavItem to="/about">About</NavItem>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isAdmin ? (
                <Link to="/admin">
                  <Button size="sm" className="min-h-9">
                    Admin console
                  </Button>
                </Link>
              ) : (
                <Link to="/profile">
                  <Button variant="ghost" size="sm" className="min-h-9">
                    Profile
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" className="min-h-9" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="min-h-9">
                  Login
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="sm" className="min-h-9">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 p-3">
            <MobileLink to="/" onClick={() => setOpen(false)}>
              Home
            </MobileLink>
            {user && !isAdmin && (
              <MobileLink to="/dashboard" onClick={() => setOpen(false)}>
                Dashboard
              </MobileLink>
            )}
            {user && !isAdmin && (
              <MobileLink to="/verify" onClick={() => setOpen(false)}>
                Verify
              </MobileLink>
            )}
            {!user && (
              <MobileLink to="/auth" onClick={() => setOpen(false)}>
                Verify
              </MobileLink>
            )}
            {user && !isAdmin && (
              <MobileLink to="/learn" onClick={() => setOpen(false)}>
                Learn
              </MobileLink>
            )}
            {!user && (
              <MobileLink to="/auth" onClick={() => setOpen(false)}>
                Learn
              </MobileLink>
            )}
            {user && !isAdmin && (
              <MobileLink to="/achievements" onClick={() => setOpen(false)}>
                Achievements
              </MobileLink>
            )}
            <MobileLink to="/about" onClick={() => setOpen(false)}>
              About
            </MobileLink>
            <div className="mt-2 flex gap-2">
              {user ? (
                <>
                  {isAdmin ? (
                    <Link to="/admin" className="flex-1" onClick={() => setOpen(false)}>
                      <Button size="sm" className="min-h-11 w-full">
                        Admin console
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/profile" className="flex-1" onClick={() => setOpen(false)}>
                      <Button variant="outline" size="sm" className="min-h-11 w-full">
                        Profile
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 flex-1"
                    onClick={signOut}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth" className="flex-1" onClick={() => setOpen(false)}>
                    <Button variant="outline" size="sm" className="min-h-11 w-full">
                      Login
                    </Button>
                  </Link>
                  <Link
                    to="/auth"
                    search={{ mode: "signup" }}
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    <Button size="sm" className="min-h-11 w-full">
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "!text-foreground bg-accent" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  to,
  children,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
    >
      {children}
    </Link>
  );
}
