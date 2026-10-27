import { getPartifulArtwork, getPartifulInvite } from "@/lib/partiful";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

async function readBounded(response: Response, maxBytes: number) {
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maxBytes) throw new Error("Preview unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Preview too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}

/** Proxy only artwork. No invitation HTML or private metadata reaches the browser. */
export async function GET(request: Request) {
  const limited = enforceRequestRateLimit(request, [{ key: "partiful-artwork:ip:{ip}", limit: 60, intervalMs: 60_000 }]);
  if (limited) return limited;
  const invite = getPartifulInvite(new URL(request.url).searchParams.get("url"));
  if (!invite) return new Response("Enter a Partiful event link.", { status: 400 });
  try {
    const signal = AbortSignal.timeout(8000);
    const page = await fetch(invite, { redirect: "error", cache: "no-store", signal });
    const html = (await readBounded(page, 2 * 1024 * 1024)).toString("utf8");
    const artwork = getPartifulArtwork(html);
    if (!artwork) throw new Error("No artwork");
    const image = await fetch(artwork, { redirect: "error", cache: "no-store", signal });
    const type = image.headers.get("content-type")?.split(";")[0].trim();
    if (!type || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) throw new Error("Unsupported artwork");
    const bytes = await readBounded(image, 8 * 1024 * 1024);
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Invitation artwork is unavailable. You can upload the artwork as a party photo instead.", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
