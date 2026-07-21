/** Max long-edge pixels before OCR/upload (design §18.5). */
export const MAX_LONG_EDGE = 1280;
export const JPEG_QUALITY = 0.78;

/**
 * Downscale + JPEG-compress an image client-side before OCR/upload.
 * Keeps aspect ratio; never upscales. Consumed by the Scan panel and OCR.
 */
export async function prepareImageForAnalysis(
  fileOrBlob: Blob,
  opts?: { maxLongEdge?: number; quality?: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxLongEdge = opts?.maxLongEdge ?? MAX_LONG_EDGE;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const bitmap = await createImageBitmap(fileOrBlob);
  const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
      "image/jpeg",
      quality,
    );
  });

  return { blob, width, height };
}
