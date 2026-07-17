import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — TrustLensAI" }] }),
  component: () => <LegalPage title="Contact" body={<>
    <p>Questions, feedback, or partnership inquiries? Reach us at <a className="text-primary underline" href="mailto:hello@trustlens.ai">hello@trustlens.ai</a>.</p>
  </>} />,
});
