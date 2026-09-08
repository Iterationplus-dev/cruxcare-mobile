import { z } from 'zod';

export const referredBySourceOptions = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'member', label: 'A CruxCare member' },
  { value: 'therapist', label: 'A CruxCare therapist' },
  { value: 'admin', label: 'CruxCare staff' },
  { value: 'google-ads', label: 'Google ads' },
  { value: 'friends-family', label: 'Friends & family' },
  { value: 'other', label: 'Other' },
] as const;

/** One sentence for every way the box can fail, so none of them is the
 *  machine talking. */
const CONSENT_MESSAGE = 'Please tick the box to agree to the Terms of Service and Privacy Policy.';

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.'),
    lastName: z.string().trim().min(1, 'Enter your last name.'),
    email: z.string().trim().email('Enter a valid email address.'),
    phone: z
      .string()
      .trim()
      .min(7, 'Enter a valid phone number.')
      .regex(/^\d+$/, 'Digits only.'),
    // Location is optional: someone who will not say where they are should
    // still be able to register. It only narrows discovery when given.
    city: z.string().trim().max(80, 'Keep this under 80 characters.').optional(),
    state: z.string().trim().max(80, 'Keep this under 80 characters.').optional(),
    country: z.string().trim().max(80, 'Keep this under 80 characters.').optional(),
    referredBySource: z.enum(
      referredBySourceOptions.map((o) => o.value) as [string, ...string[]],
      { message: 'Let us know how you heard about CruxCare.' },
    ),
    password: z
      .string()
      .min(8, 'At least 8 characters.')
      .regex(/\d/, 'Include at least one number.'),
    confirmPassword: z.string(),
    /**
     * `z.literal(true, { message })` looked right and was not: Zod applies that
     * message only when the field is missing. An unticked box sends `false`,
     * which is present-but-wrong, so the real error read
     * "Invalid literal value, expected true" — the one case that actually
     * happens was the one with the machine's wording.
     *
     * A refine puts the message on the check itself, so both routes to failure
     * say the same sentence.
     */
    consent: z
      .boolean({
        // A refine only runs once the type check passes, so a missing field
        // would otherwise fall through to Zod's "Required".
        required_error: CONSENT_MESSAGE,
        invalid_type_error: CONSENT_MESSAGE,
      })
      .refine((agreed) => agreed === true, { message: CONSENT_MESSAGE }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

/** Strength meter — same "8+ characters, one number" bar shown on CA2. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}
