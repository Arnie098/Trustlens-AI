import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { useSession } from "@/lib/auth/session";

export function SiteFooter() {
  const { user, isAdmin, loading } = useSession();
  const signedIn = Boolean(user) && !isAdmin;

  return (
    <footer className="mt-24 border-t border-white/10 bg-brand-navy text-brand-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <BrandLogo
              to="/"
              inverted
              subtitle="Think before you trust"
              size="md"
            />
            <p className="mt-3 text-sm text-brand-navy-foreground/85">
              AI-assisted media and information literacy for smarter sharing habits.
            </p>
          </div>
          <FooterCol title="Product">
            {signedIn ? (
              <>
                <FooterLink to="/verify">Verify Content</FooterLink>
                <FooterLink to="/learn">Learning Center</FooterLink>
                <FooterLink to="/dashboard">Dashboard</FooterLink>
                <FooterLink to="/achievements">Achievements</FooterLink>
              </>
            ) : (
              <>
                <FooterLink to="/auth" search={{ mode: "signup" }}>
                  Sign in to verify
                </FooterLink>
                <FooterLink to="/auth" search={{ mode: "signup" }}>
                  Sign in to learn
                </FooterLink>
                {!loading && !user && (
                  <FooterLink to="/auth" search={{ mode: "login" }}>
                    Login
                  </FooterLink>
                )}
                {isAdmin && <FooterLink to="/admin">Admin console</FooterLink>}
              </>
            )}
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
          </FooterCol>
          <FooterCol title="Legal">
            <FooterLink to="/privacy">Privacy Policy</FooterLink>
            <FooterLink to="/terms">Terms of Use</FooterLink>
            <FooterLink to="/disclaimer">Disclaimer</FooterLink>
          </FooterCol>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-brand-navy-foreground/80">
          <p>
            TrustLensAI supports critical thinking and does not replace independent fact-checking or
            human judgment. AI analysis may be incomplete, inaccurate, or biased.
          </p>
          <p className="mt-2">
            Verification analysis powered by{" "}
            <a
              href="https://www.perplexity.ai"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal underline-offset-2 hover:underline"
            >
              Perplexity
            </a>{" "}
            Sonar — real-time, web-grounded AI with cited sources.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} TrustLensAI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-brand-navy-foreground">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-brand-navy-foreground/85">{children}</ul>
    </div>
  );
}

function FooterLink({
  to,
  search,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        search={search as never}
        className="text-brand-navy-foreground/85 transition-colors hover:text-brand-navy-foreground hover:underline"
      >
        {children}
      </Link>
    </li>
  );
}
