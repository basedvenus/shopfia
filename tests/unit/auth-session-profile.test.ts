import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), nextAuth: vi.fn((_config: unknown) => ({})) }));
vi.mock("next-auth", () => ({ default: mocks.nextAuth }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));

import "@/auth";

type TestSession = { user: { id?: string; name: string | null; email: string | null; image: string | null; username?: string | null } };
const config = mocks.nextAuth.mock.calls[0]?.[0] as unknown as {
  callbacks: { session: (input: { session: TestSession; token: { sub: string; username: string } }) => Promise<TestSession> }
};
function session() { return { user: { name: "Stale Name", email: "stale@example.com", image: "/stale.jpg" } }; }
beforeEach(() => vi.clearAllMocks());
describe("authoritative session profile", () => {
  it("uses the database identity instead of stale JWT fields", async () => {
    mocks.findUnique.mockResolvedValue({ name: "Saved", email: "saved@example.com", image: "/saved-upload.jpg", username: "saved", role: "BUYER" });
    const result = await config.callbacks.session({ session: session(), token: { sub: "user_1", username: "old" } });
    expect(result.user).toMatchObject({ id: "user_1", name: "Saved", email: "saved@example.com", image: "/saved-upload.jpg", username: "saved" });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user_1" } }));
  });
  it("does not resurrect deliberately empty database fields from the old token", async () => {
    mocks.findUnique.mockResolvedValue({ name: null, email: null, image: null, username: null, role: "BUYER" });
    const result = await config.callbacks.session({ session: session(), token: { sub: "user_1", username: "old" } });
    expect(result.user).toMatchObject({ id: "user_1", name: null, image: null, username: null });
  });
  it("uses the same user's saved upload before a stale Google image or JWT photo", async () => {
    const updatedAt = new Date("2026-10-01T12:00:00Z");
    mocks.findUnique.mockResolvedValue({ id: "user_1", name: "Saved", email: "saved@example.com", image: "https://lh3.googleusercontent.com/avatar", avatar: { updatedAt }, username: "saved", role: "BUYER" });
    const result = await config.callbacks.session({ session: session(), token: { sub: "user_1", username: "old" } });
    expect(result.user.image).toBe(`/api/users/user_1/avatar?v=${updatedAt.getTime()}`);
    expect(mocks.findUnique.mock.calls[0][0].select.avatar).toEqual({ select: { updatedAt: true } });
  });
});
