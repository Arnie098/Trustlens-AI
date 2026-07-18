import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { AssistDemoBubble } from "@/src/features/assist/AssistDemoBubble";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Content height of the tab bar (icons + labels), not including system nav inset. */
const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon({
  name,
  nameFocused,
  color,
  size,
  focused,
}: {
  name: IconName;
  nameFocused: IconName;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  return <Ionicons name={focused ? nameFocused : name} size={size} color={color} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Phones with gesture nav / 3-button bar need extra bottom space so icons aren't covered.
  // Never use a fixed 60px bar — that sits under the system controls on many Androids.
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      <Tabs
        safeAreaInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
        screenOptions={{
          tabBarActiveTintColor: colors.teal,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.borderSolid,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: bottomInset,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 12,
          },
          tabBarItemStyle: {
            paddingTop: 2,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: fonts.bodySemibold,
            marginBottom: 2,
          },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.teal,
          headerTitleStyle: { fontFamily: fonts.display, color: colors.foreground },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="home-outline" nameFocused="home" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="verify/index"
          options={{
            title: "Verify",
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon
                name="shield-checkmark-outline"
                nameFocused="shield-checkmark"
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="learn/index"
          options={{
            title: "Learn",
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="book-outline" nameFocused="book" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="achievements"
          options={{
            title: "Badges",
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="trophy-outline" nameFocused="trophy" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name="person-outline" nameFocused="person" color={color} size={size} focused={focused} />
            ),
          }}
        />
      </Tabs>
      {/* Floating bubble demo (web + Expo Go). Native Android overlay when linked. */}
      <AssistDemoBubble tabBarHeight={tabBarHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
