export function partyPhotoUrl(
  id: string,
  updatedAt: Date | string | number,
  options: { width?: number; original?: boolean } = {}
) {
  const params = new URLSearchParams({ v: String(new Date(updatedAt).getTime()), render: "crop-v1" });

  if (options.original) params.set("original", "1");

  if (options.width && !options.original) {
    params.set("w", String(options.width));
  }

  return `/api/party-photos/${id}?${params.toString()}`;
}

/** Original pixels are available only to the signed-in owner for editing. */
export function partyPhotoEditorUrl(url: string) {
  if (!url.startsWith("/api/party-photos/")) return url;
  const parsed = new URL(url, "https://www.shopfia.app");
  parsed.searchParams.set("edit", "1");
  return parsed.pathname + parsed.search;
}
