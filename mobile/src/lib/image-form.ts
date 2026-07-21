/**
 * Cross-platform helpers: read a local/blob image URI into bytes or FormData parts.
 * React Native FormData `{ uri, name, type }` does NOT work on web — use Blob there.
 */
import { Platform } from "react-native";
import { File } from "expo-file-system";

function toReadableUri(uri: string): string {
  if (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("blob:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("data:")
  ) {
    return uri;
  }
  return uri.startsWith("/") ? `file://${uri}` : `file:///${uri}`;
}

/** Read image bytes from any common Expo/web URI. */
export async function readImageBytes(uri: string): Promise<{
  body: ArrayBuffer;
  size: number;
  uri: string;
}> {
  const fileUri = toReadableUri(uri);
  const errors: string[] = [];

  // Web / blob / http / data — fetch works
  if (
    Platform.OS === "web" ||
    fileUri.startsWith("blob:") ||
    fileUri.startsWith("http://") ||
    fileUri.startsWith("https://") ||
    fileUri.startsWith("data:")
  ) {
    try {
      const res = await fetch(fileUri);
      if (!res.ok) throw new Error(`fetch HTTP ${res.status}`);
      const body = await res.arrayBuffer();
      if (body.byteLength > 32) {
        return { body, size: body.byteLength, uri: fileUri };
      }
      errors.push("fetch empty");
    } catch (e) {
      errors.push(`fetch: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Native file path via Expo File API
  try {
    const file = new File(fileUri);
    const body =
      typeof file.arrayBuffer === "function"
        ? await file.arrayBuffer()
        : ((await (file as unknown as { bytes: () => Promise<Uint8Array> }).bytes())
            .buffer as ArrayBuffer);
    if (body && body.byteLength > 32) {
      return { body, size: body.byteLength, uri: fileUri };
    }
    errors.push("File API empty");
  } catch (e) {
    errors.push(`File API: ${e instanceof Error ? e.message : String(e)}`);
  }

  // XHR fallback (some Android content:// URIs)
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
          reject(new Error("unexpected xhr type"));
        } else {
          reject(new Error(`xhr ${xhr.status}`));
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
    errors.push("xhr empty");
  } catch (e) {
    errors.push(`xhr: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Could not read image (${errors.join(" | ")}). URI: ${fileUri.slice(0, 100)}`,
  );
}

/** Append an image to FormData in a way that works on both RN and web. */
export async function appendImageField(
  form: FormData,
  fieldName: string,
  uri: string,
  opts?: { name?: string; type?: string },
): Promise<void> {
  const name = opts?.name || "scan.jpg";
  const type = opts?.type || "image/jpeg";

  if (Platform.OS === "web") {
    const { body } = await readImageBytes(uri);
    form.append(fieldName, new Blob([body], { type }), name);
    return;
  }

  // React Native multipart file descriptor
  form.append(fieldName, {
    uri: toReadableUri(uri),
    name,
    type,
  } as unknown as Blob);
}

/** base64 (no data: prefix) for JSON OCR fallback. */
export async function imageUriToBase64(uri: string): Promise<string> {
  const { body } = await readImageBytes(uri);
  const bytes = new Uint8Array(body);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  // Minimal pure-JS fallback
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? chars[c & 63] : "=";
  }
  return out;
}
