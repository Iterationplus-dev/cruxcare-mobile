/**
 * Copying short values — a username, a reference — to the clipboard.
 *
 * The async Clipboard API is the path that actually runs in the Capacitor
 * WebView, which serves the app from an https origin and so counts as a secure
 * context. The `execCommand` fallback is for everywhere it is missing or
 * blocked: an insecure origin in the browser dev server, an older WebView, or a
 * permission the user has refused.
 *
 * Returns whether it worked rather than throwing, because every caller has the
 * same thing to do about a failure — say so instead of claiming a copy that did
 * not happen.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through — a refused permission or an insecure context both land
    // here, and the fallback below may still work.
  }

  return legacyCopy(text);
}

/**
 * `document.execCommand('copy')` is deprecated but still the only thing that
 * works without the async API. The textarea is kept off-screen rather than
 * hidden with `display: none`, which would make it unselectable and so
 * uncopyable.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';

  document.body.appendChild(area);

  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
