/**
 * Reliable local image → ArrayBuffer for Supabase storage on React Native.
 *
 * Do NOT use fetch(fileUri) or deprecated FileSystem.getInfoAsync — both throw
 * "Network request failed" / deprecation errors on Expo SDK 54.
 */
import { File } from "expo-file-system";

function toReadableUri(uri: string): string {
  if (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("data:")
  ) {
    return uri;
  }
  return uri.startsWith("/") ? `file://${uri}` : `file:///${uri}`;
}

export async function uriToJpegBytes(uri: string): Promise<{
  body: ArrayBuffer;
  size: number;
  uri: string;
}> {
  const fileUri = toReadableUri(uri);
  const errors: string[] = [];

  // Expo SDK 54+: new File API
  try {
    const file = new File(fileUri);
    // bytes() / arrayBuffer() read the file without fetch
    const body =
      typeof file.arrayBuffer === "function"
        ? await file.arrayBuffer()
        : ((await (file as unknown as { bytes: () => Promise<Uint8Array> }).bytes()).buffer as ArrayBuffer);

    if (body && body.byteLength > 32) {
      return { body, size: body.byteLength, uri: fileUri };
    }
    errors.push("File API returned empty buffer");
  } catch (e) {
    errors.push(`File API: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback: FormData-style path won't help; try reading via XMLHttpRequest
  try {
    const body = await new Promise<ArrayBuffer>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
          const resp = xhr.response;
          if (resp instanceof ArrayBuffer) {
            resolve(resp);
            return;
          }
          if (resp instanceof Blob) {
            void resp.arrayBuffer().then(resolve, reject);
            return;
          }
          reject(new Error("unexpected xhr response type"));
        } else {
          reject(new Error(`xhr status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("xhr network error"));
      xhr.responseType = "arraybuffer";
      xhr.open("GET", fileUri, true);
      xhr.send();
    });
    if (body.byteLength > 32) {
      return { body, size: body.byteLength, uri: fileUri };
    }
    errors.push("xhr empty buffer");
  } catch (e) {
    errors.push(`xhr: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Could not read image for upload (${errors.join(" | ")}). Path: ${fileUri.slice(0, 120)}`,
  );
}

/** @deprecated Prefer uriToJpegBytes */
export async function uriToJpegBlob(uri: string): Promise<Blob> {
  const { body } = await uriToJpegBytes(uri);
  return new Blob([body], { type: "image/jpeg" });
}
