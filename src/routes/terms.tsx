import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Use — TrustLensAI" }] }),
  component: () => <LegalPage title="Terms of Use" body={<>
    <p>By using TrustLensAI you agree to use the service lawfully and to treat all AI-generated analysis as guidance, not final judgment. You are responsible for your own decisions to share or act on content.</p>
    <p>Uploads must respect the rights of others: do not submit content you do not have permission to analyze. Misuse of the service — including automated abuse, harassment, or attempts to compromise other users' data — may result in account termination.</p>
  </>} />,
});
