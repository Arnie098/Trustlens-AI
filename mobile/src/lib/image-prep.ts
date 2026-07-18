import * as ImageManipulator from "expo-image-manipulator";

export const MAX_LONG_EDGE = 1280;

export async function prepareImageForAnalysis(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_LONG_EDGE } }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
