export function partyPhotoUrl(
  id: string,
  updatedAt: Date | string | number,
  options: { width?: number; original?: boolean } = {}
) {
  const params = new URLSearchParams({ v: String(new Date(updatedAt).getTime()) });

  if (options.original) params.set("original", "1");

  if (options.width && !options.original) {
    params.set("w", String(options.width));
  }

  return `/api/party-photos/${id}?${params.toString()}`;
}
