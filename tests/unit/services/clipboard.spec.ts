import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '@/services/clipboard';

function withClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  withClipboard(undefined);
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses the async Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    await expect(copyToClipboard('leep.pee')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('leep.pee');
  });

  it('falls back when the API is missing', async () => {
    withClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = exec;

    await expect(copyToClipboard('leep.pee')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('falls back when the API rejects, rather than giving up', async () => {
    // A refused permission lands here, and the fallback may still work.
    withClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = vi.fn().mockReturnValue(true);

    await expect(copyToClipboard('leep.pee')).resolves.toBe(true);
  });

  it('reports failure rather than claiming a copy that did not happen', async () => {
    withClipboard(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = vi.fn().mockReturnValue(false);

    await expect(copyToClipboard('leep.pee')).resolves.toBe(false);
  });

  it('does not copy an empty value', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    await expect(copyToClipboard('')).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('leaves no stray textarea behind after the fallback', async () => {
    withClipboard(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = vi.fn().mockReturnValue(true);

    await copyToClipboard('leep.pee');

    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('cleans up even when the copy throws', async () => {
    withClipboard(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = vi.fn(() => {
      throw new Error('nope');
    });

    await expect(copyToClipboard('leep.pee')).resolves.toBe(false);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});
