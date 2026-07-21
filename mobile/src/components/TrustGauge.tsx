import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { colors, trustColor, radius } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import type { TrustCategory } from "@/src/lib/types/analysis";
import { trustLabel } from "@/src/lib/trust";

export function TrustGauge({
  score,
  category,
  size = 140,
}: {
  score: number;
  category: TrustCategory;
  size?: number;
}) {
  const stroke = trustColor(category);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * clamped) / 100;
  const center = size / 2;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={colors.mutedSurface}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              fill="none"
            />
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.score, { color: stroke }]}>{clamped}</Text>
          <Text style={styles.sub}>TrustScore</Text>
        </View>
      </View>
      <View style={[styles.pill, { backgroundColor: stroke + "22", borderColor: stroke + "55" }]}>
        <Text style={[styles.label, { color: stroke }]}>{trustLabel(category)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  score: { fontSize: 40, fontFamily: fonts.displayBold, letterSpacing: -1 },
  sub: {
    fontSize: 10,
    fontFamily: fonts.bodySemibold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  pill: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: { fontSize: 13, fontFamily: fonts.bodySemibold },
});
