import { createTransport } from "nodemailer";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { securityLog } from "@/lib/security/audit-log";

function getBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configured || "http://localhost:3000";
}

function getTransport() {
  if (!authProviderConfig.emailEnabled) return null;

  return createTransport({
    host: authProviderConfig.email.host,
    port: Number(authProviderConfig.email.port),
    auth: {
      user: authProviderConfig.email.user,
      pass: authProviderConfig.email.password
    }
  });
}

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;border-radius:999px;background:#E3A7A7;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;">${label}</a>`;
}

function shell({ body, preview, title }: { body: string; preview: string; title: string }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#fff8f5;color:#2f2626;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8f5;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:28px;background:#ffffff;border:1px solid #f1d8d2;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#f4cfca,#fff8f5,#f9e0c7);padding:34px 30px 22px;">
                <p style="margin:0 0 8px;color:#9b6b65;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">ShopFia</p>
                <h1 style="margin:0;color:#2f2626;font-family:Georgia,serif;font-size:34px;line-height:1.08;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 34px;font-size:16px;line-height:1.65;color:#4f4141;">
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail({
  html,
  subject,
  text,
  to
}: {
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const transport = getTransport();
  if (!transport || !authProviderConfig.email.from) {
    securityLog("email_provider_not_configured", { subject, to });
    return { ok: false, skipped: true };
  }

  try {
    await transport.sendMail({
      from: authProviderConfig.email.from,
      html,
      subject,
      text,
      to
    });

    return { ok: true, skipped: false };
  } catch (error) {
    securityLog("email_send_failed", {
      error: error instanceof Error ? error.message : "Unknown email error",
      subject,
      to
    });
    return { ok: false, skipped: false };
  }
}

export async function sendWelcomeEmail(to: string) {
  const href = `${getBaseUrl()}/explore`;
  const html = shell({
    title: "Welcome to ShopFia",
    preview: "Discover local artisans, explore real celebrations, and connect with creatives.",
    body: `
      <p style="margin:0 0 18px;">ShopFia is a place to discover local artisans, explore real celebrations, and connect with the creatives behind unforgettable events.</p>
      <p style="margin:0 0 22px;">Whether you're planning a birthday, baby shower, dinner party, wedding, or just collecting inspiration, we're excited to have you here.</p>
      <p style="margin:0 0 24px;">Create your first party, tag the vendors who made it special, save inspiration, and explore local creatives in your area.</p>
      <p style="margin:0 0 24px;">${button("Start Exploring", href)}</p>
      <p style="margin:0;color:#8a6a67;">We can't wait to see what you create.</p>
    `
  });

  return sendEmail({
    html,
    subject: "Welcome to ShopFia ✨",
    text:
      "Welcome to ShopFia.\n\nShopFia is a place to discover local artisans, explore real celebrations, and connect with the creatives behind unforgettable events.\n\nCreate your first party, tag vendors, save inspiration, and explore local creatives in your area.\n\nStart Exploring: " +
      href +
      "\n\nWe can't wait to see what you create.",
    to
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = shell({
    title: "Reset your password",
    preview: "Create a new ShopFia password. This link expires soon.",
    body: `
      <p style="margin:0 0 18px;">We received a request to reset your ShopFia password.</p>
      <p style="margin:0 0 24px;">Use the button below to create a new password. This link expires in one hour.</p>
      <p style="margin:0 0 24px;">${button("Create New Password", resetUrl)}</p>
      <p style="margin:0;color:#8a6a67;">If you didn't request this, you can safely ignore this email.</p>
    `
  });

  return sendEmail({
    html,
    subject: "Reset your ShopFia password",
    text: `Create a new ShopFia password with this link. It expires in one hour:\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    to
  });
}

export async function sendNewInquiryEmail({
  budgetCents,
  buyerName,
  eventDate,
  eventLocation,
  inquiryUrl,
  to
}: {
  budgetCents?: number | null;
  buyerName: string;
  eventDate?: Date | null;
  eventLocation?: string | null;
  inquiryUrl: string;
  to: string;
}) {
  const dateText = eventDate
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(eventDate)
    : "an upcoming event";
  const budgetText =
    budgetCents != null
      ? new Intl.NumberFormat("en-US", {
          currency: "USD",
          maximumFractionDigits: 0,
          style: "currency"
        }).format(budgetCents / 100)
      : null;
  const locationText = eventLocation ? ` in ${eventLocation}` : "";

  const html = shell({
    title: "New inquiry on ShopFia",
    preview: `${buyerName} sent you a new inquiry for ${dateText}${locationText}.`,
    body: `
      <p style="margin:0 0 18px;">${buyerName} sent you a new event inquiry for ${dateText}${locationText}.</p>
      ${budgetText ? `<p style="margin:0 0 20px;"><strong>Budget:</strong> ${budgetText}</p>` : ""}
      <p style="margin:0 0 24px;">Open the conversation to review the event brief, inspiration, and reply through your ShopFia storefront.</p>
      <p style="margin:0 0 24px;">${button("View Inquiry", inquiryUrl)}</p>
      <p style="margin:0;color:#8a6a67;">A beautiful lead is waiting for you.</p>
    `
  });

  return sendEmail({
    html,
    subject: "New inquiry on ShopFia ✨",
    text: `${buyerName} sent you a new inquiry for ${dateText}${locationText}.\n${budgetText ? `\nBudget: ${budgetText}\n` : ""}\nView Inquiry: ${inquiryUrl}`,
    to
  });
}
