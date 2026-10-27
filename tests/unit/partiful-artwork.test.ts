import { afterEach, describe, expect, it, vi } from "vitest";
import { getPartifulArtwork, getPartifulInvite } from "@/lib/partiful";
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: () => null }));
import { GET } from "@/app/api/partiful-artwork/route";
const invite = "https://partiful.com/e/example";
const poster = "https://partiful.imgix.net/user/owner/artwork?w=1000&h=1400";
afterEach(() => vi.unstubAllGlobals());
describe("artwork-only Partiful previews", () => {
  it("canonicalizes invite links and drops tracking, query data, and fragments", () => {
    expect(getPartifulInvite(`${invite}?c=private-code#details`)).toBe(invite);
    expect(getPartifulInvite("https://www.partiful.com/e/example/")).toBe(invite);
  });
  it.each(["http://partiful.com/e/example", "https://partiful.com.evil.test/e/example", "https://partiful.com@localhost/e/example", "https://partiful.com:444/e/example", "https://partiful.com/api/private", "https://localhost/e/example"])("rejects unsafe or unsupported URLs: %s", (url) => {
    expect(getPartifulInvite(url)).toBeNull();
  });
  it("extracts artwork alone, with either metadata attribute order", () => {
    const html = `<meta property="og:description" content="Private address and guests"><meta content="${poster.replaceAll("&", "&amp;")}" property="og:image">`;
    expect(getPartifulArtwork(html)).toBe(poster);
    expect(getPartifulArtwork('<meta property="og:image" content="https://localhost/private.png">')).toBeNull();
  });
  it("returns only image bytes, without forwarding cookies or invitation details", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(`<meta property="og:description" content="Private address"><meta property="og:image" content="${poster}">`)).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new Request(`https://shopfia.app/api/partiful-artwork?url=${encodeURIComponent(invite + "?c=tracking")}`, { headers: { Cookie: "session=secret" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(fetcher.mock.calls[0][0]).toBe(invite);
    expect(fetcher.mock.calls[1][0]).toBe(poster);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
  });
  it("does not follow redirects or fetch artwork from arbitrary hosts", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<meta property="og:image" content="http://127.0.0.1/private">'));
    vi.stubGlobal("fetch", fetcher);
    expect((await GET(new Request(`https://shopfia.app/api/partiful-artwork?url=${encodeURIComponent(invite)}`))).status).toBe(502);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects HTML responses presented as artwork", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(`<meta property="og:image" content="${poster}">`)).mockResolvedValueOnce(new Response("Private event details", { headers: { "Content-Type": "text/html" } })));
    const response = await GET(new Request(`https://shopfia.app/api/partiful-artwork?url=${encodeURIComponent(invite)}`));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("Private event details");
  });
});
