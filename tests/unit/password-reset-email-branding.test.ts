import { expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
const mocks = vi.hoisted(() => ({ send: vi.fn(async (mail: unknown) => mail) }));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail: mocks.send }) }));
vi.mock("@/lib/auth/provider-config", () => ({ authProviderConfig: { emailEnabled: true, email: { host: "smtp.example.test", port: "465", user: "test", password: "test", from: "ShopFia <no-reply@shopfia.app>" } } }));
vi.mock("@/lib/security/audit-log", () => ({ securityLog: vi.fn() }));
import { sendPasswordResetEmail } from "@/lib/email";

it("uses the ShopFia logo, sans-serif heading and a clear reset button", async () => {
  vi.stubEnv("NEXTAUTH_URL", "https://www.shopfia.app");
  try {
    await sendPasswordResetEmail("test@example.test", "https://www.shopfia.app/account/reset-password?preview=1");
    const mail = mocks.send.mock.calls[0][0] as unknown as { html: string; attachments: Array<{ cid: string }> };
    expect(mail.html).toContain('src="cid:shopfia-logo"');
    expect(mail.attachments[0].cid).toBe("shopfia-logo");
    expect(mail.html).toContain("Instrument Sans");
    expect(mail.html).not.toContain("Georgia,serif");
    expect(mail.html).toContain("Create New Password");
    if (process.env.EMAIL_PREVIEW_OUTPUT) writeFileSync(process.env.EMAIL_PREVIEW_OUTPUT, mail.html.replace("cid:shopfia-logo", `data:image/png;base64,${readFileSync("public/logo.png").toString("base64")}`));
  } finally { vi.unstubAllEnvs(); }
});
