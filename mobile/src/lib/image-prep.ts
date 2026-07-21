import * as ImageManipulator from "expo-image-manipulator";

/** Matches UNESCO OCR recommended capture (~1600px wide JPEG). */
export const MAX_LONG_EDGE = 1600;

/**
 * Resize/compress when possible. On failure (some web blob URIs), returns original URI
 * so pick/upload still works instead of failing silently.
 */
export async function prepareImageForAnalysis(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_LONG_EDGE } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri || uri;
  } catch (e) {
    console.warn("[image-prep] manipulate failed, using original URI:", e);
    return uri;
  }
}
