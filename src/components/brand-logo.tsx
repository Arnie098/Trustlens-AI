import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
/** Full shield mark with transparent background (no black/white plate) */
import logoMark from "@/assets/logo-mark.png";

type BrandLogoProps = {
  /** Where the wordmark link goes */
  to?: string;
  /** Icon + wordmark (default) or large logo only */
  variant?: "mark" | "full";
  /** Text colors for dark navy bars */
  inverted?: boolean;
  className?: string;
  /** Optional subtitle under product name */
  subtitle?: string;
  /** Product name override (e.g. VeriSphere AI Admin) */
  title?: string;
  /** Show text next to mark */
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const markSize = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-11 w-11",
} as const;

/**
 * VeriSphere AI brand mark — transparent PNG, no solid black/white plate.
 */
export function BrandLogo({
  to = "/",
  variant = "mark",
  inverted = false,
  className,
  subtitle,
  title = "VeriSphere AI",
  showWordmark = true,
  size = "lg",
}: BrandLogoProps) {
  if (variant === "full") {
    return (
      <Link
        to={to}
        className={cn("inline-flex items-center justify-center", className)}
      >
        <img
          src={logoMark}
          alt="VeriSphere AI — Think before you trust"
          className="h-auto w-full max-w-[200px] object-contain drop-shadow-sm"
          width={400}
          height={400}
          decoding="async"
        />
      </Link>
    );
  }

  return (
    <Link to={to} className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <img
        src={logoMark}
        alt=""
        aria-hidden
        className={cn(
          "shrink-0 object-contain object-center",
          markSize[size],
        )}
        width={112}
        height={112}
        decoding="async"
      />
      {showWordmark && (
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate font-display text-base font-semibold leading-tight tracking-tight sm:text-lg",
              inverted ? "text-brand-navy-foreground" : "text-foreground",
            )}
          >
            {title}
          </span>
          {subtitle ? (
            <span
              className={cn(
                "hidden text-[10px] uppercase tracking-[0.18em] sm:block",
                inverted ? "text-brand-navy-foreground/75" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
