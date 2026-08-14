import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profile = {
    bio: null,
    email: "buyer@example.com",
    id: "user_1",
    image: "/api/users/user_1/avatar?v=1710000000000",
    imageCrop: { x: 50, y: 50, zoom: 1 },
    instagramUrl: null,
    name: "Buyer One",
    role: "BUYER",
    tiktokUrl: null,
    username: "buyer-one",
    vendorProfile: null
  };
  return {
    db: {
      $transaction: vi.fn(async (callback) =>
        callback({
          user: {
            findUnique: vi.fn(async () => ({ image: "/api/users/user_1/avatar?v=1710000000000" })),
            update: vi.fn(async () => profile)
          },
          userAvatar: {
            upsert: vi.fn(async () => ({
              id: "avatar_1",
              updatedAt: new Date("2024-03-09T16:00:00.000Z")
            }))
          }
        })
      )
    },
    readVerifiedImageFile: vi.fn(async (file: File) => Buffer.from(await file.arrayBuffer()))
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_1" } }))
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/security/request", () => ({
  assertSameOrigin: vi.fn(() => true),
  enforceRequestRateLimit: vi.fn(() => null)
}));
vi.mock("@/lib/security/uploads", () => ({
  readVerifiedImageFile: mocks.readVerifiedImageFile
}));

import { POST } from "@/app/api/uploads/avatar/route";

const imageCases = [
  ["JPG", "image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
  ["PNG", "image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["WebP", "image/webp", [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]]
] as const;

describe("avatar upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(imageCases)("accepts and persists a cropped %s avatar", async (_label, type, bytes) => {
    const formData = new FormData();
    formData.set("file", new File([new Uint8Array(bytes)], `avatar.${type.split("/")[1]}`, { type }));
    formData.set("crop", JSON.stringify({ x: 50, y: 50, zoom: 1 }));

    const response = await POST(
      new Request("https://www.shopfia.app/api/uploads/avatar", {
        body: formData,
        headers: { origin: "https://www.shopfia.app" },
        method: "POST"
      })
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.persisted).toBe(true);
    expect(result.url).toBe("/api/users/user_1/avatar?v=1710000000000");
    expect(result.profile.image).toBe("/api/users/user_1/avatar?v=1710000000000");
    expect(mocks.readVerifiedImageFile).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        allowedTypes: expect.any(Set),
        maxBytes: 8 * 1024 * 1024
      })
    );
  });
});
