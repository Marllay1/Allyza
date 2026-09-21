"use client";

/**
 * Re-encodes a photo in the browser before upload:
 *  - strips EXIF (GPS position, device, timestamps): privacy by default;
 *  - caps the longest side so uploads stay light on mobile data.
 * GIFs are kept untouched to preserve animation.
 */
export async function prepareImage(file: File, maxSide = 1800): Promise<{ blob: Blob; ext: string; type: string }> {
  if (file.type === "image/gif") return { blob: file, ext: "gif", type: "image/gif" };
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/webp", 0.86));
  return { blob, ext: "webp", type: "image/webp" };
}

export const isAcceptedImage = (f: File) => /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(f.type);
