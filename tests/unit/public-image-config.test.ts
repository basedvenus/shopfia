import { existsSync } from "node:fs";
import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";
import { describe, expect, it } from "vitest";

const configUrl = new URL("../../next.config.mjs", import.meta.url).href;
const { default: config } = await import(configUrl);

describe("public image optimizer allowlist", () => {
  it.each(["fairfield-lemon-tablescape.png", "vacaville-cookie-tulips.png"])("allows the bundled %s image", (file) => {
    expect(existsSync(new URL(`../../public/demo/${file}`, import.meta.url))).toBe(true);
    expect(hasLocalMatch(config.images.localPatterns, `/demo/${file}`)).toBe(true);
  });
  it("does not broaden the existing media or remote rules", () => {
    expect(config.images.localPatterns).toEqual([
      { pathname: "/api/vendor-media/**" },
      { pathname: "/demo/**", search: "" }
    ]);
    expect(hasLocalMatch(config.images.localPatterns, "/api/vendor-media/photo?v=1")).toBe(true);
    for (const path of ["/demo/image.png?v=1", "/api/users/user/avatar", "/private/image.png", "/demo-other/image.png"]) {
      expect(hasLocalMatch(config.images.localPatterns, path)).toBe(false);
    }
    expect(config.images.remotePatterns).toEqual([
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ]);
  });
});
