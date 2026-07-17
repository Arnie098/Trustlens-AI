import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-navy text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="text-lg font-bold">TrustLensAI</div>
            <p className="mt-2 text-sm opacity-80">
              Think Before You Trust. AI-assisted media and information literacy for smarter sharing
              habits.
            </p>
          </div>
          <FooterCol title="Product">
            <FooterLink to="/verify">Verify Content</FooterLink>
            <FooterLink to="/learn">Learning Center</FooterLink>
            <FooterLink to="/dashboard">Dashboard</FooterLink>
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
        <div className="mt-10 border-t border-white/10 pt-6 text-xs opacity-75">
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
              className="font-medium underline-offset-2 hover:underline"
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
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm opacity-80">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="hover:underline">
        {children}
      </Link>
    </li>
  );
}
