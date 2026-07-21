/**
 * VeriSphere "Ocean Deep" — dark abyssal theme matching web `.dark` in src/styles.css.
 * Brand anchors: #0c2340 navy, #2d8a9e teal, #5cbdb9 aqua — lifted for dark UI.
 */
export const colors = {
  // Surfaces (abyssal ocean)
  background: "#0a1424",
  foreground: "#eef7f8",
  card: "#132036",
  cardForeground: "#eef7f8",

  // Brand (keep deep navy for gradients; light text uses foreground)
  navy: "#0c2340",
  navyMid: "#1a4a6e",
  navyForeground: "#eef7f8",
  teal: "#5ed4c8",
  tealMuted: "#2d8a9e",
  tealForeground: "#0a1424",
  aqua: "#5cbdb9",

  // Semantic (web dark: primary = teal glow)
  primary: "#5ed4c8",
  primaryForeground: "#0a1424",
  secondary: "#1c2d45",
  secondaryForeground: "#eef7f8",
  muted: "#8aa8b0",
  mutedSurface: "#16283c",
  mutedForeground: "#8aa8b0",
  accent: "#3aa8a0",
  accentForeground: "#eef7f8",
  border: "rgba(255,255,255,0.12)",
  borderSolid: "#243a52",
  input: "rgba(255,255,255,0.14)",
  ring: "#5ed4c8",

  white: "#ffffff",
  black: "#000000",

  // Trust scale (readable on dark)
  trustHigh: "#3dcea0",
  trustMedium: "#e0b84a",
  trustLow: "#e08a4a",
  trustDanger: "#e05a52",
};

/** Navy → teal (brand gradient) */
export const gradientPrimary = ["#0c2340", "#2d8a9e"] as const;
/** Deep ocean wash for screens */
export const gradientHero = ["#0a1424", "#0f1f35", "#132a40"] as const;
/** Soft teal glow */
export const gradientGlow = ["#1a4a6e", "#2d8a9e", "#5ed4c8"] as const;

export const shadowElegant = {
  shadowColor: "#000000",
  shadowOpacity: 0.45,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;

export const shadowGlow = {
  shadowColor: "#5ed4c8",
  shadowOpacity: 0.28,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export type TrustColorKey =
  | "high_trust"
  | "needs_verification"
  | "low_confidence"
  | "potentially_misleading";

export const trustColor = (c: TrustColorKey) =>
  ({
    high_trust: colors.trustHigh,
    needs_verification: colors.trustMedium,
    low_confidence: colors.trustLow,
    potentially_misleading: colors.trustDanger,
  })[c];
