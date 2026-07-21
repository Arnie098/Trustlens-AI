/**
 * Expo config plugin: overlay + screen-capture permissions for Floating Assist.
 * Service/Activity are declared in modules/floating-assist AndroidManifest (merged).
 */
const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

function withFloatingAssist(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    AndroidConfig.Permissions.ensurePermissions(manifest, [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      "android.permission.POST_NOTIFICATIONS",
    ]);

    // Remove duplicate broken service entry if an older prebuild left a fully-qualified
    // class that wasn't on the app classpath (build/runtime failures).
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (Array.isArray(app.service)) {
      app.service = app.service.filter((s) => {
        const n = String(s.$?.["android:name"] || "");
        return (
          !n.includes("FloatingBubbleService") &&
          !n.includes("MediaProjectionCaptureService")
        );
      });
      if (app.service.length === 0) delete app.service;
    }
    if (Array.isArray(app.activity)) {
      app.activity = app.activity.filter(
        (a) => !String(a.$?.["android:name"] || "").includes("ScreenCaptureActivity"),
      );
      if (app.activity.length === 0) delete app.activity;
    }

    return config;
  });
}

module.exports = withFloatingAssist;
