/** Keep only the event URL; invitation tracking codes are never saved or fetched. */
export function getPartifulInvite(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["partiful.com", "www.partiful.com"].includes(url.hostname) || url.port || url.username || url.password) return null;
    if (!/^\/e\/[a-zA-Z0-9_-]{1,128}\/?$/.test(url.pathname)) return null;
    return `https://partiful.com${url.pathname.replace(/\/$/, "")}`;
  } catch { return null; }
}

/** Read only the poster's Open Graph image, never title, description or event data. */
export function getPartifulArtwork(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [match[1].toLowerCase(), match[3]]));
    if (attributes.property?.toLowerCase() !== "og:image") continue;
    try {
      const image = new URL((attributes.content ?? "").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))));
      if (image.protocol !== "https:" || image.hostname !== "partiful.imgix.net" || image.port || image.username || image.password || !image.pathname.startsWith("/user/")) return null;
      return image.href;
    } catch { return null; }
  }
  return null;
}
