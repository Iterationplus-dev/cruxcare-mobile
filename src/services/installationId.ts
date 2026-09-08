import { secureStorage, SECURE_STORAGE_KEYS } from '@/services/secureStorage';

let cached: string | null = null;

/**
 * A stable id for this installation, kept in secure storage. Deliberately not
 * a hardware identifier: it must not survive a reinstall or be correlatable
 * across apps, it only has to outlive a token rotation.
 *
 * Two things need it, which is why it does not live inside the push service:
 * push registration is keyed on it, and the API records it against a session
 * token at issue time so signing one device out can revoke that installation's
 * notifications too (backend note §11.2). It is not a credential and nothing
 * authenticates on the strength of holding it.
 */
export async function getInstallationId(): Promise<string> {
  if (cached) return cached;

  const stored = await secureStorage.get(SECURE_STORAGE_KEYS.pushInstallationId);
  if (stored) {
    cached = stored;
    return stored;
  }

  const created = crypto.randomUUID();
  await secureStorage.set(SECURE_STORAGE_KEYS.pushInstallationId, created);
  cached = created;
  return created;
}

/** Test seam — the module-level cache would otherwise leak between specs. */
export function resetInstallationIdCache(): void {
  cached = null;
}
