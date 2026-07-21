import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function capturePhoto(): Promise<Blob | null> {
  if (!isNativePlatform()) {
    // Web fallback: file input handled by caller
    return null;
  }
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    width: 1600,
    correctOrientation: true,
  });
  if (!photo.webPath) return null;
  const res = await fetch(photo.webPath);
  return res.blob();
}

export async function pickFromGallery(): Promise<Blob | null> {
  if (!isNativePlatform()) return null;
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos,
    width: 1600,
    correctOrientation: true,
  });
  if (!photo.webPath) return null;
  const res = await fetch(photo.webPath);
  return res.blob();
}

export async function readClipboardText(): Promise<string> {
  if (isNativePlatform()) {
    const { value } = await Clipboard.read();
    return value?.trim() ?? "";
  }
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return "";
  }
}
