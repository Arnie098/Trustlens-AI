import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useSession } from "@/src/features/auth/session";
import { colors } from "@/src/theme/colors";

export default function Index() {
  const { user, loading, configured } = useSession();
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }
  if (!configured || !user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
