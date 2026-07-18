import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — TrustLensAI" }] }),
  component: () => (
    <LegalPage
      title="Contact"
      body={
        <>
          <p>
            Questions, feedback, or partnership inquiries? Email us at{" "}
            <a href="mailto:hello@trustlens.ai">hello@trustlens.ai</a>.
          </p>
          <p>
            We typically respond within 2–3 business days. For account or data-deletion requests,
            include the email address on your TrustLensAI account so we can locate your records.
          </p>
          <p className="text-sm text-muted-foreground">
            This is a mail link only — there is no web form. Please do not send passwords or
            verification content that you need to keep private beyond normal email security.
          </p>
        </>
      }
    />
  ),
});
