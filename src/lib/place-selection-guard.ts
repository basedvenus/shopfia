/** Prevent a delayed place lookup from replacing a newer selection or manual edit. */
export function createPlaceSelectionGuard() {
  let version = 0;
  return {
    invalidate() {
      version += 1;
    },
    start() {
      const requestVersion = ++version;
      return () => requestVersion === version;
    }
  };
}
