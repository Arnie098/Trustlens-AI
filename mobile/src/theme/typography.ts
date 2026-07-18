/**
 * Font families mirroring the web app:
 *   --font-display: "Space Grotesk"  (headings/titles)
 *   --font-sans:    "DM Sans"        (body/UI)
 * Names must match the keys passed to useFonts() in app/_layout.tsx.
 */
export const fonts = {
  display: "SpaceGrotesk_600SemiBold",
  displayBold: "SpaceGrotesk_700Bold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemibold: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
} as const;
