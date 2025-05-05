/**
 * Email validation using regex.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Checks if a string is a valid positive integer (natural number).
 */
export function isValidNaturalNumber(value: string): boolean {
  const n = Number(value);
  return value !== '' && !isNaN(n) && Number.isInteger(n) && n > 0;
}

/**
 * Checks if a string is a valid number (can be float or int).
 */
export function isValidNumber(value: string): boolean {
  const n = Number(value);
  return value !== '' && !isNaN(n);
}
