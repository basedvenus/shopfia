import { getPartifulInvite } from "@/lib/partiful";

export function getPartyInvitation(value: string | null | undefined): { provider: "partiful" | "luma"; url: string } | null {
  const partiful = getPartifulInvite(value);
  if (partiful) return { provider: "partiful", url: partiful };
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["lu.ma", "luma.com", "www.luma.com"].includes(url.hostname) || url.port || url.username || url.password) return null;
    if (!/^\/[a-zA-Z0-9_-]{1,128}\/?$/.test(url.pathname)) return null;
    return { provider: "luma", url: `https://${url.hostname}${url.pathname.replace(/\/$/, "")}` };
  } catch { return null; }
}
