/**
 * Whether a recorded sign-in attempt worked.
 *
 * The API's vocabulary is `succeeded` / `failed`. It is a single string
 * comparison, extracted only so it can be tested — getting it wrong renders
 * every real sign-in as a failed attempt on the reader's own security screen,
 * which is exactly the mistake it was written to fix.
 *
 * Anything unrecognised counts as a failure: on this screen the safe direction
 * to be wrong in is the one that draws attention.
 */
export function loginSucceeded(outcome: string): boolean {
  return outcome === 'succeeded';
}
