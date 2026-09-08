import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  centred,
  clampTransform,
  displayRatio,
  panBy,
  toCrop,
  zoomAbout,
  type CropView,
} from '@/utils/cropFrame';

/** 300px window over a 4000x3000 landscape photo: the short edge (3000) is
 * scaled to 300, so one window pixel covers ten source pixels at scale 1. */
const landscape: CropView = { frame: 300, width: 4000, height: 3000 };
const portrait: CropView = { frame: 300, width: 1080, height: 1920 };

describe('displayRatio', () => {
  it('scales the short edge to fill the window', () => {
    expect(displayRatio(landscape, 1)).toBeCloseTo(0.1);
    expect(displayRatio(landscape, 2)).toBeCloseTo(0.2);
  });

  it('returns 0 before the window has been measured', () => {
    expect(displayRatio({ ...landscape, frame: 0 }, 1)).toBe(0);
  });
});

describe('centred', () => {
  it('centres the overflowing axis and pins the covered one', () => {
    // 4000x3000 at k=0.1 displays 400x300: 100px of overflow, half each side.
    expect(centred(landscape)).toEqual({ scale: 1, x: -50, y: 0 });
    // 1080x1920 at k=300/1080 displays 300x533.3.
    expect(centred(portrait).x).toBe(0);
    expect(centred(portrait).y).toBeCloseTo(-116.67, 2);
  });
});

describe('clampTransform', () => {
  it('stops the photo before its edge enters the window', () => {
    const dragged = { scale: 1, x: 200, y: 200 };
    expect(clampTransform(landscape, dragged)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('stops the far edge at the window bottom-right', () => {
    const dragged = { scale: 1, x: -900, y: -900 };
    // Displayed size is 400x300, so x bottoms out at 300-400 and y at 0.
    expect(clampTransform(landscape, dragged)).toEqual({ scale: 1, x: -100, y: 0 });
  });

  it('holds scale inside its range', () => {
    expect(clampTransform(landscape, { scale: 12, x: 0, y: 0 }).scale).toBe(MAX_SCALE);
    expect(clampTransform(landscape, { scale: 0.2, x: 0, y: 0 }).scale).toBe(MIN_SCALE);
  });
});

describe('panBy', () => {
  it('moves by the drag delta', () => {
    expect(panBy(landscape, centred(landscape), 20, 0)).toEqual({ scale: 1, x: -30, y: 0 });
  });

  it('will not drag past the edge', () => {
    expect(panBy(landscape, centred(landscape), 500, 500)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe('zoomAbout', () => {
  it('keeps the focal point over the same part of the photo', () => {
    const start = centred(landscape);
    const zoomed = zoomAbout(landscape, start, 2, 150, 150);

    // The source pixel under the window centre before and after must match.
    const before = (150 - start.x) / displayRatio(landscape, start.scale);
    const after = (150 - zoomed.x) / displayRatio(landscape, zoomed.scale);
    expect(after).toBeCloseTo(before);
  });

  it('clamps the result so zooming out cannot bare a corner', () => {
    const zoomedIn = zoomAbout(landscape, centred(landscape), 4, 0, 0);
    const backOut = zoomAbout(landscape, zoomedIn, 1, 0, 0);

    expect(backOut.scale).toBe(MIN_SCALE);
    expect(backOut.y).toBe(0);
    expect(backOut.x).toBeGreaterThanOrEqual(-100);
    expect(backOut.x).toBeLessThanOrEqual(0);
  });

  it('is inert before the window has been measured', () => {
    const start = { scale: 1, x: 0, y: 0 };
    expect(zoomAbout({ ...landscape, frame: 0 }, start, 2, 0, 0)).toBe(start);
  });
});

describe('toCrop', () => {
  it('converts the framed window back into source pixels', () => {
    const crop = toCrop(landscape, centred(landscape));
    expect(crop?.x).toBeCloseTo(500);
    expect(crop?.y).toBeCloseTo(0);
    expect(crop?.size).toBeCloseTo(3000);
  });

  it('reports a tighter square as the member zooms in', () => {
    const zoomed = zoomAbout(landscape, centred(landscape), 3, 150, 150);
    const crop = toCrop(landscape, zoomed);

    expect(crop?.size).toBeCloseTo(1000);
    // Still centred on the same point: 500 + (3000 - 1000) / 2.
    expect(crop?.x).toBeCloseTo(1500);
    expect(crop?.y).toBeCloseTo(1000);
  });

  it('follows a pan into the top-left corner', () => {
    const panned = panBy(landscape, centred(landscape), 500, 500);
    const crop = toCrop(landscape, panned);
    expect(crop?.x).toBeCloseTo(0);
    expect(crop?.y).toBeCloseTo(0);
    expect(crop?.size).toBeCloseTo(3000);
  });

  it('returns null before the window has been measured', () => {
    expect(toCrop({ ...landscape, frame: 0 }, { scale: 1, x: 0, y: 0 })).toBeNull();
  });
});
