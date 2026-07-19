/**
 * Reliable local image → ArrayBuffer for Supabase storage.
 * Works on React Native, Expo web (blob:), and content:// URIs.
 */
import { readImageBytes } from "@/src/lib/image-form";

export async function uriToJpegBytes(uri: string): Promise<{
  body: ArrayBuffer;
  size: number;
  uri: string;
}> {
  return readImageBytes(uri);
}

/** @deprecated Prefer uriToJpegBytes */
export async function uriToJpegBlob(uri: string): Promise<Blob> {
  const { body } = await uriToJpegBytes(uri);
  return new Blob([body], { type: "image/jpeg" });
}
