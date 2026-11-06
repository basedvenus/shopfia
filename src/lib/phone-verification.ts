/** Accept explicit international numbers, with a US default for ten digits. */
export function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const phone = /^\d{10}$/.test(compact) ? `+1${compact}` : /^1\d{10}$/.test(compact) ? `+${compact}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function maskPhoneNumber(phone: string) {
  return `••• ••• ${phone.slice(-4)}`;
}
