/**
 * Types for the vendored-doc stamper, which is plain JS so it can be run with
 * bare `node` and no build step. The hashing lives there rather than being
 * duplicated into the test: two copies of the rule is the thing the vendoring
 * agreement exists to prevent.
 */

/** Vendored contract docs, relative to the repo root. */
export declare const VENDORED: string[];

/** Everything after the banner, with line endings normalised to `\n`. */
export declare function bodyOf(text: string): string;

/** sha256 of `bodyOf(text)`, hex-encoded. */
export declare function hashOf(text: string): string;
