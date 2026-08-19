import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_EDGE_PX, prepareAvatarUpload } from '@/utils/avatarImage';

/** jsdom ships no raster pipeline, so we stand in for the decode/encode pair
 * and assert on the crop geometry handed to the 2D context. */
type DrawCall = number[];

function stubCanvas(draws: DrawCall[], blob: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (_src: unknown, ...args: number[]) => draws.push(args),
    }),
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  };
  vi.spyOn(document, 'createElement').mockImplementation(
    () => canvas as unknown as HTMLElement,
  );
  return canvas;
}

/** Stands in for jsdom's inert `Image`, which never fires load or error. */
function stubImage(result: { width: number; height: number } | 'error') {
  vi.stubGlobal(
    'Image',
    class {
      width = result === 'error' ? 0 : result.width;
      height = result === 'error' ? 0 : result.height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => (result === 'error' ? this.onerror?.() : this.onload?.()));
      }
    },
  );
}

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  );
}

const original = new File(['original-bytes'], 'selfie.png', { type: 'image/png' });

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('prepareAvatarUpload', () => {
  it('centre-crops a landscape photo when no crop was chosen', async () => {
    const draws: DrawCall[] = [];
    const canvas = stubCanvas(draws);
    stubBitmap(4000, 3000);

    await prepareAvatarUpload(original);

    expect(canvas.width).toBe(AVATAR_EDGE_PX);
    expect(canvas.height).toBe(AVATAR_EDGE_PX);
    // sx offsets by half the excess width; the source square is the short edge.
    expect(draws[0]).toEqual([500, 0, 3000, 3000, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX]);
  });

  it('centres the crop vertically on a portrait photo when none was chosen', async () => {
    const draws: DrawCall[] = [];
    stubCanvas(draws);
    stubBitmap(1080, 1920);

    await prepareAvatarUpload(original);

    expect(draws[0]).toEqual([0, 420, 1080, 1080, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX]);
  });

  it('never upscales an image smaller than the target edge', async () => {
    const draws: DrawCall[] = [];
    const canvas = stubCanvas(draws);
    stubBitmap(200, 300);

    await prepareAvatarUpload(original);

    expect(canvas.width).toBe(200);
    expect(draws[0]?.slice(6)).toEqual([200, 200]);
  });

  it('honours the square the member framed', async () => {
    const draws: DrawCall[] = [];
    const canvas = stubCanvas(draws);
    stubBitmap(4000, 3000);

    await prepareAvatarUpload(original, { x: 900, y: 120, size: 1500 });

    expect(canvas.width).toBe(AVATAR_EDGE_PX);
    expect(draws[0]).toEqual([900, 120, 1500, 1500, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX]);
  });

  it('pulls an out-of-bounds crop back inside the image', async () => {
    const draws: DrawCall[] = [];
    stubCanvas(draws);
    stubBitmap(1000, 800);

    // Oversized and off the right/bottom edges — clamped to the short edge.
    await prepareAvatarUpload(original, { x: 950, y: -40, size: 1200 });

    expect(draws[0]?.slice(0, 4)).toEqual([200, 0, 800, 800]);
  });

  it('does not upscale a small hand-picked crop', async () => {
    const draws: DrawCall[] = [];
    const canvas = stubCanvas(draws);
    stubBitmap(4000, 3000);

    await prepareAvatarUpload(original, { x: 100, y: 100, size: 300 });

    expect(canvas.width).toBe(300);
    expect(draws[0]).toEqual([100, 100, 300, 300, 0, 0, 300, 300]);
  });

  it('returns a JPEG file named after the original', async () => {
    stubCanvas([]);
    stubBitmap(1000, 1000);

    const result = await prepareAvatarUpload(original);

    expect(result.name).toBe('selfie.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(result).not.toBe(original);
  });

  it('falls back to the original file when encoding yields nothing', async () => {
    stubCanvas([], null);
    stubBitmap(1000, 1000);

    expect(await prepareAvatarUpload(original)).toBe(original);
  });

  it('decodes via <img> when createImageBitmap is unavailable', async () => {
    const draws: DrawCall[] = [];
    stubCanvas(draws);
    vi.stubGlobal('createImageBitmap', undefined);
    stubImage({ width: 2000, height: 2000 });

    const result = await prepareAvatarUpload(original);

    expect(draws[0]).toEqual([0, 0, 2000, 2000, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX]);
    expect(result.name).toBe('selfie.jpg');
  });

  it('falls back to the original file when the image cannot be decoded', async () => {
    stubCanvas([]);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image'); }));
    stubImage('error');

    expect(await prepareAvatarUpload(original)).toBe(original);
  });
});
