import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getVendorSocialProfile } from "@/lib/vendor-social";
import { VendorSocialFeeds } from "@/components/vendor/vendor-social-feeds";

describe("vendor public social feeds", () => {
  it.each(["sample.shop", "@sample.shop", "https://instagram.com/sample.shop/?igsh=123", "www.instagram.com/sample.shop"])("normalizes Instagram %s", (input) => {
    expect(getVendorSocialProfile(input, "instagram")?.url).toBe("https://www.instagram.com/sample.shop/");
  });
  it.each(["@sample.shop", "sample.shop", "https://www.tiktok.com/@sample.shop?lang=en"])("normalizes TikTok %s", (input) => {
    expect(getVendorSocialProfile(input, "tiktok")?.url).toBe("https://www.tiktok.com/@sample.shop/");
  });
  it.each(["https://evil.test/shop", "https://instagram.com.evil.test/shop", "https://user:pass@instagram.com/shop", "javascript:alert(1)", "https://instagram.com/p/123", "https://instagram.com/explore", "https://instagram.com/shop/extra", "https://instagram.com:8443/shop"])("rejects unsupported Instagram targets %s", (input) => {
    expect(getVendorSocialProfile(input, "instagram")).toBeNull();
  });
  it("renders feeds and fallback links without an owner account or claim status", () => {
    const html = renderToStaticMarkup(createElement(VendorSocialFeeds, { instagramUrl: "https://instagram.com/sample", tiktokUrl: "https://tiktok.com/@sample" }));
    expect(html).toContain('src="https://www.instagram.com/sample/embed/"');
    expect(html).toContain('aria-label="TikTok feed"');
    expect(html).toContain("Open Instagram profile");
    expect(html).toContain("Open TikTok profile");
  });
  it("hides empty and invalid social profiles", () => {
    expect(renderToStaticMarkup(createElement(VendorSocialFeeds, { instagramUrl: "https://evil.test/shop" }))).toBe("");
  });
});
