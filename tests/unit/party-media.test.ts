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
