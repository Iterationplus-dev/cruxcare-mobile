import type { AvatarCrop } from './avatarImage';

/** Geometry for a square crop window over a pannable, zoomable photo.
 *
 * Kept free of the DOM so the arithmetic — the part that decides which pixels
 * a member actually gets — is testable on its own; the component supplies the
 * measurements and applies the results.
 *
 * At scale 1 the photo is laid out "cover": its short edge exactly fills the
 * window, so a clamped transform can never expose an empty corner.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;

/** The measured window and the photo's natural size, in their own pixels. */
export interface CropView {
  frame: number;
  width: number;
  height: number;
}

/** Where the photo sits in the window: `x`/`y` are its top-left corner in
 * window pixels (both ≤ 0 once clamped). */
export interface CropTransform {
  scale: number;
  x: number;
  y: number;
}

/** Displayed pixels per source pixel at `scale`. */
export function displayRatio(view: CropView, scale: number): number {
  const short = Math.min(view.width, view.height);
  if (!short || !view.frame) return 0;
  return (view.frame / short) * scale;
}

/** Opening state: fully zoomed out, photo centred in the window. */
export function centred(view: CropView): CropTransform {
  const k = displayRatio(view, MIN_SCALE);
  return {
    scale: MIN_SCALE,
    x: (view.frame - view.width * k) / 2,
    y: (view.frame - view.height * k) / 2,
  };
}

/** Holds the scale in range and keeps the photo covering the window. */
export function clampTransform(view: CropView, transform: CropTransform): CropTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, transform.scale));
  const k = displayRatio(view, scale);
  return {
    scale,
    x: Math.min(0, Math.max(view.frame - view.width * k, transform.x)),
    y: Math.min(0, Math.max(view.frame - view.height * k, transform.y)),
  };
}

export function panBy(
  view: CropView,
  transform: CropTransform,
  dx: number,
  dy: number,
): CropTransform {
  return clampTransform(view, { ...transform, x: transform.x + dx, y: transform.y + dy });
}

/** Zooms to `nextScale` about a window-relative point, so whatever sits under
 * the member's fingers — or the window centre, for the slider — stays put. */
export function zoomAbout(
  view: CropView,
  transform: CropTransform,
  nextScale: number,
  focusX: number,
  focusY: number,
): CropTransform {
  const before = displayRatio(view, transform.scale);
  if (!before) return transform;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  const ratio = displayRatio(view, scale) / before;
  return clampTransform(view, {
    scale,
    x: focusX - (focusX - transform.x) * ratio,
    y: focusY - (focusY - transform.y) * ratio,
  });
}

/** The framed square, translated from window pixels back to source pixels. */
export function toCrop(view: CropView, transform: CropTransform): AvatarCrop | null {
  const k = displayRatio(view, transform.scale);
  if (!k) return null;
  return { x: -transform.x / k, y: -transform.y / k, size: view.frame / k };
}
