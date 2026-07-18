package ai.trustlens.floatingassist

import android.content.Intent

/**
 * Holds one-shot screen-capture consent (MediaProjection result) and the last saved frame path.
 * Consent is requested via Android's system dialog — never silent capture.
 */
object CaptureResultStore {
  @Volatile
  var resultCode: Int = 0

  @Volatile
  var resultData: Intent? = null

  @Volatile
  var lastCapturePath: String? = null

  fun hasConsent(): Boolean = resultData != null && resultCode != 0

  fun setConsent(resultCode: Int, data: Intent?) {
    this.resultCode = resultCode
    this.resultData = data?.let { Intent(it) }
  }

  fun clearConsent() {
    resultCode = 0
    resultData = null
  }
}
