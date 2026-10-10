import { describe, expect, it } from "vitest";
import { decode, encode, getToken } from "@auth/core/jwt";
import sharp from "sharp";

describe("patched security dependency compatibility", () => {
  it("keeps Auth.js encrypted session tokens compatible", async () => {
    const secret = "unit-test-only-not-an-application-secret";
    const salt = "authjs.session-token";
    const token = await encode({ secret, salt, token: { sub: "unit-user", role: "BUYER" } });

    await expect(decode({ secret, salt, token })).resolves.toMatchObject({
      sub: "unit-user",
      role: "BUYER"
    });
    await expect(getToken({
      secret,
      req: new Request("https://example.test/api/session", {
        headers: { cookie: `${salt}=${token}` }
      })
    })).resolves.toMatchObject({ sub: "unit-user", role: "BUYER" });
  });

  it("rejects a malformed bearer token without throwing", async () => {
    await expect(getToken({
      secret: "unit-test-only-not-an-application-secret",
      req: new Request("https://example.test/api/session", {
        headers: { authorization: "Bearer %invalid" }
      })
    })).resolves.toBeNull();
  });

  it("runs the native party-photo resize and WebP pipeline", async () => {
    const input = await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#d99b92" }
    }).png().toBuffer();

    const output = await sharp(input)
      .rotate()
      .resize({ width: 96, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await expect(sharp(output).metadata()).resolves.toMatchObject({
      format: "webp",
      width: 96,
      height: 48
    });
  });
});
