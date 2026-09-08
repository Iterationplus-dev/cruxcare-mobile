/** Camera originals run several megabytes; the largest avatar we render is 64px
 * CSS (≈192px at 3x DPR). Uploading the original wastes the member's data and
 * stalls the save, so we centre-crop to a square and downscale before upload. */
export const AVATAR_EDGE_PX = 512;
const AVATAR_QUALITY = 0.82;

type Drawable = ImageBitmap | HTMLImageElement;

/** A square region of the source image, in source pixels, as chosen by the
 * member in the cropper. Omit it to fall back to a centred crop. */
export interface AvatarCrop {
  x: number;
  y: number;
  size: number;
}

/**
 * Crops `file` to the square the member framed (centred if none was given) and
 * downscales it to at most `edge` pixels, re-encoded as JPEG. Never upscales.
 * Returns the original file untouched if the browser cannot decode or re-encode
 * it, so a failure here can never block the upload.
 */
export async function prepareAvatarUpload(
  file: File,
  crop?: AvatarCrop,
  edge = AVATAR_EDGE_PX,
): Promise<File> {
  let source: Drawable | null = null;
  try {
    source = await decode(file);
    const region = clampCrop(crop, source.width, source.height);
    const side = region.size;
    if (!side) return file;

    const target = Math.min(edge, side);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(source, region.x, region.y, side, side, 0, 0, target, target);

    const blob = await toBlob(canvas);
    if (!blob) return file;

    return new File([blob], toJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (source && 'close' in source) source.close();
  }
}

/** Keeps the requested square inside the image whatever the caller asked for,
 * so a stale or rounded crop can never produce transparent edges. */
function clampCrop(crop: AvatarCrop | undefined, width: number, height: number): AvatarCrop {
  const shortEdge = Math.min(width, height);
  if (!crop) {
    return { x: (width - shortEdge) / 2, y: (height - shortEdge) / 2, size: shortEdge };
  }

  const size = Math.min(Math.max(crop.size, 0), shortEdge);
  return {
    x: Math.min(Math.max(crop.x, 0), width - size),
    y: Math.min(Math.max(crop.y, 0), height - size),
    size,
  };
}

/** `createImageBitmap` applies EXIF orientation; the <img> path is the fallback
 * for engines that lack it (and honours EXIF natively on modern WebViews). */
async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to the <img> decoder */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', AVATAR_QUALITY);
  });
}

function toJpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'avatar';
  return `${base}.jpg`;
}
