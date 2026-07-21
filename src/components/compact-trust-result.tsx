import { X } from "lucide-react";
import type { TrustCategory } from "@/lib/db";
import { trustLabel } from "@/lib/ai/mock-analyze";
import { TrustGauge } from "@/components/trust-gauge";
import { Button } from "@/components/ui/button";

export type CompactTrustResultProps = {
  trustScore: number;
  category: TrustCategory | string;
  summary: string;
  onDetails?: () => void;
  onDismiss?: () => void;
};

/**
 * Compact TrustScore card for mobile sticky summary / overlay-style results.
 */
export function CompactTrustResult({
  trustScore,
  category,
  summary,
  onDetails,
  onDismiss,
}: CompactTrustResultProps) {
  const cat = category as TrustCategory;
  const label = trustLabel(cat);
  const clipped = summary.length > 140 ? `${summary.slice(0, 137).trimEnd()}…` : summary;

  return (
    <div
      role="status"
      className="glass relative flex gap-3 rounded-2xl border border-white/10 p-3 shadow-glow sm:gap-4 sm:p-4"
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          aria-label="Dismiss summary"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="shrink-0">
        <TrustGauge score={trustScore} category={cat} size={88} />
      </div>
      <div className={`min-w-0 flex-1 ${onDismiss ? "pr-6" : ""}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          TrustScore
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
            {trustScore}
          </span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{clipped}</p>
        {onDetails && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onDetails}
            className="mt-1 h-auto min-h-0 px-0 text-teal"
          >
            Full details
          </Button>
        )}
      </div>
    </div>
  );
}
