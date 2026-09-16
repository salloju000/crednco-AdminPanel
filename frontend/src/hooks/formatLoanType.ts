/**
 * Human-readable loan type label. Backend values are camelCase
 * ("personalLoan") in current records and snake_case in some older ones
 * ("personal_loan"); both become "Personal Loan".
 */
export function formatLoanType(raw: unknown, fallback = 'Unknown'): string {
  const value = raw == null ? '' : String(raw).trim();
  if (!value) return fallback;
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
