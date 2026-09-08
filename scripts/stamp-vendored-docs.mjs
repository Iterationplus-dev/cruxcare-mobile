import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Records the body hash in each vendored contract doc's banner.
 *
 * The banner asks people not to edit a vendored copy. Asking is not enforcing —
 * the whole reason these files drifted apart in the first place is that nothing
 * checked. `tests/unit/docs/vendoredDocs.spec.ts` recomputes these hashes and
 * fails the build when one no longer matches, which turns a local edit into a
 * red test instead of a discovery three notes later.
 *
 * Run this after re-vendoring, never to "fix" a failing check: a mismatch means
 * either someone edited a vendored file (undo it, and make the change in
 * cci/docs) or the file was re-vendored (then this is the right command).
 *
 *   node scripts/stamp-vendored-docs.mjs
 */

export const VENDORED = [
  'docs/PUSH_NOTIFICATIONS_CONTRACT.md',
  'docs/PAYMENTS_MONNIFY_CONTRACT.md',
];

const HASH_LINE = /^ {2}body-sha256: [0-9a-f]{64}$/m;

/**
 * Everything after the banner, with line endings normalised.
 *
 * Normalising matters more than it looks: this repository has a Windows working
 * tree and git rewrites endings on checkout, so hashing the raw bytes would
 * fail on a fresh clone rather than on an edit — a check that cries wolf gets
 * switched off, which is worse than not having one.
 */
export function bodyOf(text) {
  const end = text.indexOf('-->');
  const body = end === -1 ? text : text.slice(end + 3);
  return body.replace(/^\r?\n/, '').replace(/\r\n/g, '\n');
}

export function hashOf(text) {
  return createHash('sha256').update(bodyOf(text), 'utf8').digest('hex');
}

function main() {
  for (const path of VENDORED) {
    const text = readFileSync(path, 'utf8');
    const hash = hashOf(text);
    const line = `  body-sha256: ${hash}`;

    let next;
    if (HASH_LINE.test(text)) {
      next = text.replace(HASH_LINE, line);
    } else {
      // Anchored to the policy sentence rather than to the attribution above
      // it, whose shape differs between files. Note `\r?` throughout: these are
      // CRLF files and `.` does not match a carriage return.
      const anchor = /(\r?\n)(\r?\n)( {2}cci\/docs\/ is canonical)/;
      next = text.replace(anchor, `$1${line}$1$2$3`);
      if (next === text) {
        console.error(`could not place the hash line in ${path}`);
        process.exitCode = 1;
        continue;
      }
    }

    writeFileSync(path, next);
    console.log(`${path}  ${hash.slice(0, 12)}…`);
  }
}

// Only when run directly, so the test can import the helpers above.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}
