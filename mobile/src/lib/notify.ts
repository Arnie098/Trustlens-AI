import { Alert, Platform } from "react-native";

/** Alert that works on native and Expo web (window.alert fallback). */
export function notify(title: string, message?: string) {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}
