package ai.trustlens.app

import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Leave splash theme before super so first frame is AppTheme (avoids stuck splash)
    setTheme(R.style.AppTheme)
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // Hard timeout: never leave the user on the splash screen more than 1.5s
    Handler(Looper.getMainLooper()).postDelayed({
      try {
        // Reflective hide if available
        val clazz = Class.forName("expo.modules.splashscreen.SplashScreenManager")
        val hide = clazz.methods.firstOrNull { it.name.contains("hide", ignoreCase = true) && it.parameterTypes.isEmpty() }
        hide?.invoke(SplashScreenManager)
      } catch (_: Exception) {
      }
      // Also ensure window uses app theme background
      try {
        window?.setBackgroundDrawableResource(android.R.color.transparent)
      } catch (_: Exception) {
      }
    }, 1500)
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled,
      ) {},
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
