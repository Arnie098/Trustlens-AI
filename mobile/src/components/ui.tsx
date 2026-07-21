import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  colors,
  gradientPrimary,
  gradientHero,
  shadowElegant,
  radius,
} from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Deep ocean wash matching web dark gradient feel. */
export function GradientBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={[...gradientHero]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.screen, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function Card({
  children,
  style,
  elevated = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}) {
  return <View style={[styles.card, elevated && shadowElegant, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style, props.multiline && styles.textarea]}
    />
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;
  const labelColor = isPrimary ? colors.white : colors.teal;
  const label = (
    <>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.btnText, { color: labelColor }]}>{title}</Text>
      )}
    </>
  );

  if (isPrimary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.btnWrap,
          shadowElegant,
          isDisabled && { opacity: 0.55 },
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 },
        ]}
      >
        <LinearGradient
          colors={[...gradientPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          {label}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        isDisabled && { opacity: 0.55 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {label}
    </Pressable>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Pill({
  children,
  color = colors.teal,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color + "28", borderColor: color + "66" }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSolid,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bodySemibold,
    color: colors.foreground,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSolid,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.foreground,
  },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  btnWrap: { borderRadius: radius.pill, overflow: "hidden" },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnSecondary: {
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: colors.tealMuted,
  },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { fontSize: 16, fontFamily: fonts.bodySemibold, letterSpacing: 0.2 },
  muted: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, lineHeight: 21 },
  title: {
    fontSize: 30,
    fontFamily: fonts.displayBold,
    color: colors.foreground,
    letterSpacing: -0.8,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 2.5,
    color: colors.teal,
    textTransform: "uppercase",
  },
  section: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontFamily: fonts.bodySemibold },
});
