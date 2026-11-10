/** Lower-cases and trims an e-mail address so comparisons are stable. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sherpa is single-user: only the address in ALLOWED_EMAIL may sign in.
 * Fails closed: with no allowed address configured, nobody is allowed.
 */
export function isAllowedEmail(
  email: string | null | undefined,
  allowed: string | null | undefined,
): boolean {
  if (!email || !allowed) return false;
  const expected = normalizeEmail(allowed);
  return expected.length > 0 && normalizeEmail(email) === expected;
}
