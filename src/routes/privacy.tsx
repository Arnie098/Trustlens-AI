import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TrustLensAI" },
      { name: "description", content: "How TrustLensAI collects, uses, and protects your data." },
    ],
  }),
  component: () => <LegalPage title="Privacy Policy" body={<>
    <p>We collect only the data required to provide the service: your account details, submissions you choose to verify, and your learning progress. You control AI-processing consent from your profile and can withdraw it or delete your data at any time.</p>
    <p>We do not sell your personal data. Aggregate, non-identifying analytics may be used to improve the product. Uploaded images are stored privately and are only accessible to you and, in limited cases, TrustLensAI administrators for moderation.</p>
  </>} />,
});

export function LegalPage({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/85 [&_a]:font-medium [&_a]:text-teal [&_a]:underline-offset-2 hover:[&_a]:underline">
          {body}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
