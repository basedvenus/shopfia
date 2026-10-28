export function getVendorSocialProfile(value: string | null | undefined, platform: "instagram" | "tiktok") {
  const input = value?.trim();
  if (!input) return null;
  const host = platform === "instagram" ? "www.instagram.com" : "www.tiktok.com";
  const bare = input.replace(/^@/, "");
  let handle: string;
  if (/^[a-zA-Z0-9._]+$/.test(bare)) handle = bare;
  else {
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      if (url.protocol !== "https:" || url.username || url.password || url.port || ![host, host.replace("www.", ""), `m.${platform}.com`].includes(url.hostname)) return null;
      const match = url.pathname.match(platform === "instagram" ? /^\/([a-zA-Z0-9._]+)\/?$/ : /^\/@([a-zA-Z0-9._]+)\/?$/);
      if (!match) return null;
      handle = match[1];
    } catch { return null; }
  }
  if (handle.length > (platform === "instagram" ? 30 : 24) || ["p", "reel", "reels", "stories", "explore", "accounts"].includes(handle.toLowerCase())) return null;
  return { handle, url: `https://${host}/${platform === "tiktok" ? "@" : ""}${handle}/` };
}
