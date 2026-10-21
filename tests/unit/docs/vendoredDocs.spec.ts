import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VENDORED, bodyOf, hashOf } from '../../../scripts/stamp-vendored-docs.mjs';

/**
 * A vendored contract doc must match the hash recorded in its own banner.
 *
 * The banner asks people not to edit these files and to change `cci/docs/`
 * instead. Asking is all it did — and an unenforced rule is what let two copies
 * of the same contract drift for weeks until someone diffed two repositories by
 * hand. This turns a local edit into a failing build in the repository where the
 * edit happened, which is the only place that can see it.
 *
 * A failure here is not fixed by re-running the stamper. It means either
 * somebody edited a vendored file — undo it, make the change upstream — or the
 * file was legitimately re-vendored at a new SHA, and then re-stamping is right.
 */
const root = resolve(__dirname, '../../..');

/** The script is plain JS, so its exports arrive untyped. */
const vendored: string[] = VENDORED;
const HASH_IN_BANNER = /^ {2}body-sha256: ([0-9a-f]{64})$/m;

describe('vendored contract docs', () => {
  it.each(vendored)('%s matches the hash in its banner', (relative) => {
    const text = readFileSync(resolve(root, relative), 'utf8');
    const recorded = text.match(HASH_IN_BANNER)?.[1];

    expect(recorded, `no body-sha256 in the banner of ${relative}`).toBeDefined();
    expect(hashOf(text), `${relative} has been edited since it was vendored`).toBe(recorded);
  });

  it.each(vendored)('%s still carries the SHA it came from', (relative) => {
    const text = readFileSync(resolve(root, relative), 'utf8');

    // Without this, deleting the banner outright would remove the hash line and
    // the first assertion would fail on a missing value rather than a changed
    // one — the right outcome, but for a reason nobody could read.
    expect(text).toMatch(/^ {2}Taken from cci\/docs\/ at [0-9a-f]{40}$/m);
  });

  it('hashes the body only, so a line-ending rewrite is not an edit', () => {
    const crlf = '<!--\r\n  a\r\n-->\r\n# Title\r\n\r\nBody.\r\n';
    const lf = '<!--\n  a\n-->\n# Title\n\nBody.\n';

    // This repository has a Windows working tree and git rewrites endings on
    // checkout. A hash over raw bytes would fail on a fresh clone rather than on
    // an edit, and a check that cries wolf gets switched off.
    expect(bodyOf(crlf)).toBe(bodyOf(lf));
    expect(hashOf(crlf)).toBe(hashOf(lf));
  });
});
