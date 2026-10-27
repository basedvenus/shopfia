import { getTikTokVideo, isTikTokShareUrl } from "@/lib/party-media";

/** Follow short share links only on TikTok's fixed hosts, with a bounded timeout. */
export async function resolvePartyTikTokUrl(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const direct = getTikTokVideo(value);
  if (direct) return direct.url;
  let current = value.trim();
  const signal = AbortSignal.timeout(5000);
  for (let hop = 0; hop < 4; hop++) {
    if (!isTikTokShareUrl(current)) throw new Error("Paste the full TikTok video link from your browser.");
    const response = await fetch(current, { method: "HEAD", redirect: "manual", signal, cache: "no-store" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) break;
    const next = new URL(location, current).href;
    const video = getTikTokVideo(next);
    if (video) return video.url;
    current = next;
  }
  throw new Error("Could not open that TikTok share link. Paste the full video link from your browser.");
}
