/**
 * Turning a token name into something a person recognises.
 *
 * The server names a device from the user agent it signed in with, which for
 * the Android WebView is
 * `Dalvik/2.1.0 (Linux; U; Android 16; sdk_gphone64_x86_64 Build/BE2A…)`.
 * That is precise and useless: the whole job of the devices screen is telling
 * someone which of these is theirs, and nobody recognises a Dalvik string.
 *
 * This reads what it can and falls back to the original rather than inventing
 * a name — an unparsed agent is still more informative than "Unknown device".
 */

/** `Android 16 · Pixel 8`, `iPhone · iOS 17`, `Chrome on Windows`. */
export function friendlyDeviceName(raw: string | null | undefined): string {
  const agent = (raw ?? '').trim();
  if (!agent) return 'Unnamed device';

  // Already a plain name rather than an agent string — some clients register
  // one directly, and it should be shown as sent.
  if (!/[();/]/.test(agent)) return agent;

  const android = agent.match(/Android\s+([\d.]+)/i);
  if (android) {
    const model = androidModel(agent);
    return model ? `${model} · Android ${android[1]}` : `Android ${android[1]}`;
  }

  const ios = agent.match(/(iPhone|iPad|iPod).*?OS\s+([\d_]+)/i);
  if (ios) {
    return `${ios[1]} · iOS ${ios[2].replace(/_/g, '.')}`;
  }

  const browser = agent.match(/\b(Chrome|Firefox|Safari|Edg|Edge|Opera)\b/);
  const desktop = agent.match(/\b(Windows|Macintosh|Mac OS X|Linux|CrOS)\b/);
  if (browser && desktop) {
    return `${browser[1] === 'Edg' ? 'Edge' : browser[1]} on ${desktop[1] === 'Macintosh' ? 'Mac' : desktop[1]}`;
  }

  // Nothing recognised. The raw agent is long, so it is trimmed rather than
  // discarded — it may still be the only thing that distinguishes two rows.
  return agent.length > 48 ? `${agent.slice(0, 48).trimEnd()}…` : agent;
}

/**
 * The model out of an Android agent.
 *
 * The build token that follows it is dropped — `Build/BE2A.250530.026.D1` is a
 * fingerprint, not something anyone reads.
 */
function androidModel(agent: string): string | null {
  const match = agent.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\s*[;)]/i);
  const model = match?.[1]?.trim();

  if (!model || /^[\d.]+$/.test(model)) return null;
  return model;
}
