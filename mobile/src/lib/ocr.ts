/**
 * Text extraction from still images.
 * Tries native ML Kit if a linked module exists; otherwise returns empty
 * (user edits caption manually). Still-image only — never continuous OCR.
 */
export type OcrResult = {
  text: string;
  engine: "native" | "none";
};

export async function recognizeTextFromImageUri(uri: string): Promise<OcrResult> {
  // Optional native module (dev client / prebuild):
  // npm i @react-native-ml-kit/text-recognition  + prebuild
  try {
    // Dynamic require so Expo Go does not crash when module is missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MlKit = require("@react-native-ml-kit/text-recognition");
    if (MlKit?.default?.recognize) {
      const result = await MlKit.default.recognize(uri);
      const text = String(result?.text ?? "").trim();
      return { text, engine: "native" };
    }
  } catch {
    /* module not installed */
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const alt = require("expo-text-recognition");
    if (alt?.recognizeText) {
      const text = String(await alt.recognizeText(uri)).trim();
      return { text, engine: "native" };
    }
  } catch {
    /* not available in Expo Go */
  }

  return { text: "", engine: "none" };
}
