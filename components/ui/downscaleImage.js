// A phone photo is routinely 4000px and several megabytes. Sent as-is it would
// blow the request limit, cost more on a per-image model, and tell the chair
// nothing a 1280px copy does not. Downscaling happens before anything leaves
// the device.

const MAX_EDGE = 1280;
const QUALITY = 0.82;

export default async function downscaleImage(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Always JPEG: a screenshot re-encoded as PNG can come out larger than the
    // original, which defeats the point of being here.
    return { url: canvas.toDataURL('image/jpeg', quality), width, height };
  } finally {
    // Without this the decoded bitmap is held until GC decides otherwise, and
    // picking several large photos in a row is exactly when that matters.
    bitmap.close?.();
  }
}
