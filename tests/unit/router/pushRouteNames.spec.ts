import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every route name the push catalogue sends at must exist in the router.
 *
 * The backend's own `PushRouteContractTest` asserts they never send a URL path
 * where a route name belongs. This is the other half: a name that is spelled
 * correctly but does not exist here fails exactly the same way — the app falls
 * back to the notifications inbox, nothing errors, and nothing is logged. The
 * fallback that makes the contract safe is what hides the mistake, so the rule
 * has to be checked mechanically or it decays (backend note N3.3).
 *
 * It catches drift from our side too: renaming a route that a notification
 * targets breaks the tap, and this is what says so.
 */
function routeNamesInRouter(): Set<string> {
  const src = readFileSync(resolve(__dirname, '../../../src/router/routes.ts'), 'utf8');
  return new Set([...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]));
}

/**
 * The `route` column of the catalogue's tables. Read from the vendored contract
 * rather than hardcoded: a list repeated here would be a third copy of the
 * thing the vendoring agreement exists to stop having.
 */
function routeNamesInCatalogue(): Map<string, number> {
  const doc = readFileSync(
    resolve(__dirname, '../../../docs/PUSH_NOTIFICATIONS_CONTRACT.md'),
    'utf8',
  ).replace(/\r\n/g, '\n');

  const found = new Map<string, number>();
  let routeColumn = -1;
  let inCatalogue = false;

  for (const line of doc.split('\n')) {
    // Scoped to section 4. The same events are tabulated a second time inside
    // §3.3, as a narrative of the notes they came from, so reading every table
    // in the file counts each of those events twice.
    if (/^## /.test(line)) inCatalogue = /^## 4\./.test(line);
    if (!inCatalogue) continue;

    if (!line.trim().startsWith('|')) {
      // Any non-table line ends the current table, so a `route` column never
      // leaks into the next one.
      routeColumn = -1;
      continue;
    }

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const header = cells.findIndex((c) => /^`?route`?$/.test(c));
    if (header >= 0) {
      routeColumn = header;
      continue;
    }
    if (routeColumn < 0 || /^-+$/.test(cells[0] ?? '')) continue;

    const name = cells[routeColumn]?.match(/`([a-z][a-z0-9-]*)`/)?.[1];
    if (name) found.set(name, (found.get(name) ?? 0) + 1);
  }

  return found;
}

describe('push catalogue route names', () => {
  it('names a route this app actually defines, for every send', () => {
    const known = routeNamesInRouter();
    const cited = routeNamesInCatalogue();

    const missing = [...cited.keys()].filter((name) => !known.has(name));

    expect(missing, `not defined in src/router/routes.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('reads a catalogue that still has rows in it', () => {
    // Guards the parser rather than the contract: a doc reshuffle that silently
    // stopped matching would make the test above pass by finding nothing.
    expect(routeNamesInCatalogue().size).toBeGreaterThan(5);
  });
});
