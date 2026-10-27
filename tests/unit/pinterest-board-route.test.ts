import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/pinterest-board/route";
describe("isolated Pinterest board preview", () => {
  it.each(["https://example.com/user/board/", "javascript:alert(1)", "https://www.pinterest.com/pin/123/"])("rejects non-board URL %s", (url) => {
    expect(GET(new Request(`https://www.shopfia.app/api/pinterest-board?url=${encodeURIComponent(url)}`)).status).toBe(400);
  });
  it("builds an isolated official board widget from a canonical link", async () => {
    const response = GET(new Request("https://www.shopfia.app/api/pinterest-board?url=https%3A%2F%2Fwww.pinterest.com%2Fbasedvenus%2Fhalloween-bday%2F"));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(html).toContain("https://assets.pinterest.com/js/pinit.js");
    expect(html).toContain("embedBoard");
    expect(html).toContain("https://www.pinterest.com/basedvenus/halloween-bday/");
    expect(html).toContain("requestAnimationFrame");
  });
});
