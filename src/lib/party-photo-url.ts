export function partyPhotoUrl(
  id: string,
  updatedAt: Date | string | number,
  options: { width?: number } = {}
) {
  const params = new URLSearchParams({ v: String(new Date(updatedAt).getTime()) });

  if (options.width) {
    params.set("w", String(options.width));
  }

  return `/api/party-photos/${id}?${params.toString()}`;
}
