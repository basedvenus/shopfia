import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Keep the exact existing restrictions while allowing Google's profile-photo host.
const original = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://*.stripe.com",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.stripe.network https://*.supabase.co wss://*.supabase.co",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "upgrade-insecure-requests"
];
describe("Uploaded profile photo CSP", () => {
  it("does not allow automatic Google avatar images and leaves the original policy intact", () => {
    const config = readFileSync(new URL("../../next.config.mjs", import.meta.url), "utf8");
    const directives = [...config.matchAll(/"((?:default|script|style|img|connect|frame|object|base|form)[^"\n]+|upgrade-insecure-requests)"/g)].map((match) => match[1]);
    expect(directives).toEqual(original);
    expect(directives.find((directive) => directive.startsWith("img-src "))?.split(" ")).not.toContain("https://unrelated.example.com");
    expect(directives.join(" ")).not.toContain("https://*.googleusercontent.com");
  });
});
