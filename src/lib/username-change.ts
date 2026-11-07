export const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
export function canChangeUsername(lastChangedAt: Date | null, now = new Date()) {
  return !lastChangedAt || now.getTime() - lastChangedAt.getTime() >= USERNAME_CHANGE_INTERVAL_MS;
}
