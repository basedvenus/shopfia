import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getAppleMusicPlaylist, getTikTokVideo, isTikTokShareUrl } from "@/lib/party-media";
import { resolvePartyTikTokUrl } from "@/lib/services/party-media";
import { PartyMedia } from "@/components/parties/party-media";

const video = "https://www.tiktok.com/@scout2015/video/6718335390845095173";
const playlist = "https://music.apple.com/us/playlist/party/pl.u-123abc";
afterEach(() => vi.unstubAllGlobals());

describe("party media links", () => {
  it("builds provider players and removes tracking parameters", () => {
    expect(getTikTokVideo(`${video}?is_from_webapp=1`)?.url).toBe(video);
    expect(getTikTokVideo(video)?.embedUrl).toContain("/player/v1/6718335390845095173?autoplay=0");
    expect(getAppleMusicPlaylist(`${playlist}?ls=1`)?.embedUrl).toBe("https://embed.music.apple.com/us/playlist/party/pl.u-123abc?theme=auto");
    expect(getAppleMusicPlaylist("https://music.apple.com/gb/playlist/pl.123")?.url).toBe("https://music.apple.com/gb/playlist/pl.123");
  });
  it.each([
    "javascript:alert(1)", "http://music.apple.com/us/playlist/pl.123", "https://music.apple.com.evil.test/us/playlist/pl.123",
    "https://user:pass@music.apple.com/us/playlist/pl.123", "https://music.apple.com:9000/us/playlist/pl.123",
    "https://music.apple.com/us/album/party/123", "https://music.apple.com/us/playlist/party/pl.123/extra"
  ])("rejects unsafe or non-playlist URLs: %s", (url) => expect(getAppleMusicPlaylist(url)).toBeNull());
  it.each(["https://evil.test/@user/video/6718335390845095173", "https://www.tiktok.com/@user", "https://www.tiktok.com:9999/@user/video/6718335390845095173"])("rejects non-video URLs: %s", (url) => expect(getTikTokVideo(url)).toBeNull());
  it("resolves short share links without fetching the destination video", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: `${video}?share=1` } }));
    vi.stubGlobal("fetch", fetcher);
    expect(isTikTokShareUrl("https://vm.tiktok.com/abc123/")).toBe(true);
    expect(await resolvePartyTikTokUrl("https://vm.tiktok.com/abc123/")).toBe(video);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual", method: "HEAD" });
  });
  it("never follows a short link redirect to an unrelated host", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(resolvePartyTikTokUrl("https://vm.tiktok.com/abc123/")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not make network calls for direct or empty links", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await resolvePartyTikTokUrl(video)).toBe(video);
    expect(await resolvePartyTikTokUrl("")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("renders both accessible inline players and fallback links, and omits absent media", () => {
    const html = renderToStaticMarkup(createElement(PartyMedia, { tiktokUrl: video, appleMusicUrl: playlist }));
    expect(html).toContain('title="Party TikTok video"');
    expect(html).toContain('title="Party Apple Music playlist"');
    expect(html).toContain('https://embed.music.apple.com/');
    expect(html).toContain("Open on TikTok");
    expect(renderToStaticMarkup(createElement(PartyMedia, {}))).toBe("");
  });
});

// Editor columns must size players by their available width, not the viewport.
it("stacks media in narrow editor columns", () => {
  const html = renderToStaticMarkup(createElement(PartyMedia, { tiktokUrl: video, appleMusicUrl: playlist }));
  expect(html).toContain("repeat(auto-fit, minmax(min(100%, 340px), 1fr))");
  expect(html).not.toContain("sm:grid-cols-2");
});

it("accepts Pinterest mood boards and rejects profile or unrelated links", async () => {
  const { getPinterestBoard } = await import("@/lib/party-media");
  expect(getPinterestBoard("https://www.pinterest.com/venus/party-mood/?tracking=1")).toBe("https://www.pinterest.com/venus/party-mood/");
  expect(getPinterestBoard("https://www.pinterest.com/venus/")).toBeNull();
  expect(getPinterestBoard("https://www.pinterest.com/pin/123456789/")).toBeNull();
  expect(getPinterestBoard("https://evil.test/venus/party-mood/")).toBeNull();
});

it("resolves Pinterest short links through its allowlisted redirect service", async () => {
  const { resolvePartyPinterestUrl } = await import("@/lib/services/party-media");
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 308, headers: { location: "https://api.pinterest.com/url_shortener/7gQwNcKp1/redirect/" } }))
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://www.pinterest.com/basedvenus/halloween-bday/?sender=test" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await resolvePartyPinterestUrl("https://pin.it/7gQwNcKp1")).toBe("https://www.pinterest.com/basedvenus/halloween-bday/");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "HEAD", redirect: "manual" });
});
it("does not follow Pinterest redirects to unrelated or credential-bearing URLs", async () => {
  const { resolvePartyPinterestUrl } = await import("@/lib/services/party-media");
  for (const location of ["https://127.0.0.1/private", "https://api.pinterest.com.evil.test/url_shortener/abcd/redirect/", "https://user:pass@api.pinterest.com/url_shortener/abcd/redirect/"]) {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(resolvePartyPinterestUrl("https://pin.it/abcd1234")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it("keeps full Pinterest board links network-free and rejects profile share destinations", async () => {
  const { resolvePartyPinterestUrl } = await import("@/lib/services/party-media");
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://www.pinterest.com/basedvenus/" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await resolvePartyPinterestUrl("https://www.pinterest.com/basedvenus/halloween-bday/?tracking=1")).toBe("https://www.pinterest.com/basedvenus/halloween-bday/");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(resolvePartyPinterestUrl("https://pin.it/abcd1234")).rejects.toThrow();
});
