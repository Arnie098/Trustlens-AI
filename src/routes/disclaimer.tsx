import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({ meta: [{ title: "Disclaimer — TrustLensAI" }] }),
  component: () => <LegalPage title="Disclaimer" body={<>
    <p>TrustLensAI is an educational tool that supports critical thinking. It does not replace independent fact-checking, journalism, expert opinion, or human judgment.</p>
    <p>AI analysis may be incomplete, inaccurate, or biased. TrustScores and explanations are signals, not verdicts. Always verify important claims with multiple credible, independent sources before believing or sharing.</p>
  </>} />,
});
