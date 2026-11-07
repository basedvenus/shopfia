import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
  const port = Number(authProviderConfig.email.port);

  return createTransport({
    host: authProviderConfig.email.host,
    port,
    secure: port === 465,
    auth: {
      user: authProviderConfig.email.user,
      pass: authProviderConfig.email.password
    }
  });
}

function button(label: string, href: string) {
  return `<a class="email-button" href="${href}" style="display:inline-block;border-radius:999px;background:#e3a7a7;background-image:linear-gradient(90deg,#e3a7a7,#eab8b3);color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;">${label}</a>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailIdentity = { name: string; image?: string | null };
type EmailAttachment = { filename: string; content: Buffer; contentType: string; cid: string };

function identityImage(identity: EmailIdentity, cid: string, attachments: EmailAttachment[]) {
  const image = identity.image?.trim();
  const embedded = image?.match(/^data:image\/(png|jpe?g|webp|gif);base64,([a-z0-9+/=\s]+)$/i);
  let src: string | null = null;
  if (embedded) {
    attachments.push({filename: `${cid}.${embedded[1]}`,content:Buffer.from(embedded[2], "base64"),contentType:`image/${embedded[1]}`,cid});
    src = `cid:${cid}`;
  } else if (image) {
    try {
      const url = new URL(image, getBaseUrl());
      if (["https:", "http:"].includes(url.protocol)) src = url.href;
    } catch { /* Use initials for an invalid image. */ }
  }
  const style = "display:inline-block;width:100px;height:100px;border:4px solid #ffffff;border-radius:50%;vertical-align:middle;background:#fff8f5;object-fit:cover;";
  return src ? `<img class="email-avatar" src="${escapeHtml(src)}" width="100" height="100" alt="${escapeHtml(identity.name)}" style="${style}" />`
    : `<span class="email-avatar" role="img" aria-label="${escapeHtml(identity.name)}" style="${style}text-align:center;line-height:100px;color:#586b7b;font-size:24px;font-weight:700;">${escapeHtml(identity.name.split(/\s+/).map(part=>part[0]).slice(0,2).join(""))}</span>`;
}

function shell({ body, preview, title, identities = "" }: { body: string; preview: string; title: string; identities?: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>
      @font-face { font-family:"Instrument Sans"; font-style:normal; font-weight:400 700; src:url("https://www.shopfia.app/email/instrument-sans.woff2") format("woff2"); }
      :root { color-scheme:light only; supported-color-schemes:light; }
      .email-page { background-color:#fff8f5 !important; color:#2f2626 !important; }
      .email-card { background-color:#ffffff !important; }
      .email-content { background-color:#fce1e4 !important; color:#4f4141 !important; }
      .email-header { background-color:#ffffff !important; color:#2f2626 !important; }
      .email-title { color:#586b7b !important; }
      .email-button { background-color:#e3a7a7 !important; color:#ffffff !important; }
      @media screen and (max-width:480px) {
        .email-header, .email-content { padding:24px 20px !important; }
        .email-title { font-size:28px !important; }
        .email-avatar { width:62px !important; height:62px !important; }
        .email-identities { width:124px !important; }
        .email-logo { width:200px !important; }
      }
    </style>
  </head>
  <body class="email-page" style="margin:0;background:#fff8f5;color:#2f2626;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
    <table class="email-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fff8f5" style="background:#fff8f5;padding:28px 14px;">
      <tr>
        <td align="center">
          <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:660px;border-radius:28px;background:#ffffff;border:1px solid #f1d8d2;overflow:hidden;">
            <tr>
              <td class="email-header" bgcolor="#ffffff" style="background:#ffffff;color:#2f2626;padding:30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;">
                <img class="email-logo" src="cid:shopfia-logo" width="300" alt="Shopfia" style="display:block;width:300px;max-width:100%;height:auto;margin:0 0 32px;border:0;" />
                <h1 class="email-title" style="margin:0;color:#586b7b;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;letter-spacing:-1.2px;line-height:1.1;">${escapeHtml(title)}</h1>
                </td>${identities ? `<td class="email-identities" width="190" align="right" style="width:190px;vertical-align:middle;white-space:nowrap;">${identities}</td>` : ""}</tr></table>
              </td>
            </tr>
            <tr>
              <td class="email-content" bgcolor="#fce1e4" style="background:#fce1e4;background-image:linear-gradient(135deg,#fcdee3 0%,#fff4ef 100%);padding:28px 30px 34px;font-size:16px;line-height:1.65;color:#4f4141;">
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
  to,
  attachments = []
}: {
  attachments?: EmailAttachment[];
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
      from: {
        name: "Shopfia 🧁",
        address: authProviderConfig.email.from.match(/<([^<>]+)>/)?.[1]?.trim() ?? authProviderConfig.email.from.trim()
      },
      attachments: [{
        filename: "shopfia-logo.png",
        content: await readFile(join(process.cwd(), "public", "logo.png")),
        contentType: "image/png",
        cid: "shopfia-logo"
      }, ...attachments],
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
    title: "Welcome to Shopfia",
    preview: "Discover local artisans, explore real celebrations, and connect with creatives.",
    body: `
      <p style="margin:0 0 18px;">Shopfia is a place to discover local artisans, explore real celebrations, and connect with the creatives behind unforgettable events.</p>
      <p style="margin:0 0 22px;">Whether you're planning a birthday, baby shower, dinner party, wedding, or just collecting inspiration, we're excited to have you here.</p>
      <p style="margin:0 0 24px;">Create your first party, tag the vendors who made it special, save inspiration, and explore local creatives in your area.</p>
      <p style="margin:0 0 24px;">${button("Start Exploring", href)}</p>
      <p style="margin:0;color:#8a6a67;">We can't wait to see what you create.</p>
    `
  });

  return sendEmail({
    html,
    subject: "Welcome to Shopfia ✨",
    text:
      "Welcome to Shopfia.\n\nShopfia is a place to discover local artisans, explore real celebrations, and connect with the creatives behind unforgettable events.\n\nCreate your first party, tag vendors, save inspiration, and explore local creatives in your area.\n\nStart Exploring: " +
      href +
      "\n\nWe can't wait to see what you create.",
    to
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = shell({
    title: "Reset your password",
    preview: "Create a new Shopfia password. This link expires soon.",
    body: `
      <p style="margin:0 0 18px;">We received a request to reset your Shopfia password.</p>
      <p style="margin:0 0 24px;">Use the button below to create a new password. This link expires in one hour.</p>
      <p style="margin:0 0 24px;">${button("Create New Password", resetUrl)}</p>
      <p style="margin:0;color:#8a6a67;">If you didn't request this, you can safely ignore this email.</p>
    `
  });

  return sendEmail({
    html,
    subject: "Reset your Shopfia password",
    text: `Create a new Shopfia password with this link. It expires in one hour:\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
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
    title: "New inquiry on Shopfia",
    preview: `${buyerName} sent you a new inquiry for ${dateText}${locationText}.`,
    body: `
      <p style="margin:0 0 18px;">${buyerName} sent you a new event inquiry for ${dateText}${locationText}.</p>
      ${budgetText ? `<p style="margin:0 0 20px;"><strong>Budget:</strong> ${budgetText}</p>` : ""}
      <p style="margin:0 0 24px;">Open the conversation to review the event brief, inspiration, and reply through your Shopfia storefront.</p>
      <p style="margin:0 0 24px;">${button("View Inquiry", inquiryUrl)}</p>
      <p style="margin:0;color:#8a6a67;">A beautiful lead is waiting for you.</p>
    `
  });

  return sendEmail({
    html,
    subject: "New inquiry on Shopfia ✨",
    text: `${buyerName} sent you a new inquiry for ${dateText}${locationText}.\n${budgetText ? `\nBudget: ${budgetText}\n` : ""}\nView Inquiry: ${inquiryUrl}`,
    to
  });
}

export async function sendNewMessageEmail({
  contextTitle,
  conversationUrl,
  messagePreview,
  senderName,
  to,
  requester,
  business
}: {
  contextTitle: string;
  conversationUrl: string;
  messagePreview: string;
  senderName: string;
  to: string;
  requester?: EmailIdentity;
  business?: EmailIdentity;
}) {
  const preview =
    messagePreview.length > 140 ? `${messagePreview.slice(0, 137).trim()}...` : messagePreview;
  const safeContextTitle = escapeHtml(contextTitle);
  const safePreview = escapeHtml(preview);
  const safeSenderName = escapeHtml(senderName);
  const attachments: EmailAttachment[] = [];
  const identities = requester && business ? `${identityImage(requester,"requester-avatar",attachments)}<span style="display:inline-block;margin-left:-28px;position:relative;">${identityImage(business,"business-avatar",attachments)}</span>` : "";
  const html = shell({
    identities,
    title: "New Shopfia message",
    preview: `${senderName} replied about ${contextTitle}.`,
    body: `
      <p style="margin:0 0 18px;"><strong>${safeSenderName}</strong> sent you a new message about <strong>${safeContextTitle}</strong>.</p>
      <div style="margin:0 0 24px;border-radius:20px;background:#fff8f5;border:1px solid #f1d8d2;padding:16px 18px;color:#4f4141;">${safePreview}</div>
      <p style="margin:0 0 24px;">Open the conversation to keep planning through Shopfia.</p>
      <p style="margin:0 0 24px;">${button("View Message", conversationUrl)}</p>
      <p style="margin:0;color:#8a6a67;">A thoughtful reply keeps the celebration moving.</p>
    `
  });

  return sendEmail({
    attachments,
    html,
    subject: "New message on Shopfia ✨",
    text: `${senderName} sent you a new message about ${contextTitle}.\n\n${preview}\n\nView Message: ${conversationUrl}`,
    to
  });
}

export async function sendPartyNotificationEmail({ to, title, path }: { to: string; title: string; path: string }) {
  // Notification paths are generated by the application, never supplied by a guest.
  const href = new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/notifications", getBaseUrl()).href;
  const preferences = new URL("/notifications", getBaseUrl()).href;
  return sendEmail({
    to,
    subject: title,
    text: `${title}\n\nView on Shopfia: ${href}\n\nManage notification preferences: ${preferences}`,
    html: shell({ title: "Your party update", preview: escapeHtml(title), body: `<p>${escapeHtml(title)}</p><p>${button("View on Shopfia", href)}</p><p><a href="${preferences}">Manage notification preferences</a></p>` })
  });
}

export async function sendAccountNotificationEmail({to,title,path,kind,requester,business}: {to:string;title:string;path:string;kind:"NEW_FOLLOWER" | "SERVICE_REQUEST";requester?:EmailIdentity;business?:EmailIdentity}) {
  const href = new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/notifications", getBaseUrl()).href;
  const heading = kind === "SERVICE_REQUEST" ? "New Party Request" : "You have a new follower";
  const attachments: EmailAttachment[] = [];
  const identities = requester && business ? `${identityImage(requester,"requester-avatar",attachments)}<span style="display:inline-block;margin-left:-28px;position:relative;">${identityImage(business,"business-avatar",attachments)}</span>` : "";
  return sendEmail({
    to,
    attachments,
    subject: `${heading} on Shopfia 🧁`,
    text: `${title}\n\nView on Shopfia: ${href}\n\nThis is an automated notification. Please do not reply to this email.`,
    html: shell({title:heading,identities,preview:escapeHtml(title),body:`<p>${escapeHtml(title)}</p><p>${button(kind === "SERVICE_REQUEST" ? "View party request" : "View on Shopfia",href)}</p><p style="font-size:12px;color:#8a6a67;">This is an automated notification. Please do not reply to this email.</p>`})
  });
}

export async function sendPasswordChangedEmail(to: string) {
  const recoveryUrl = new URL("/account/forgot-password", getBaseUrl()).href;
  return sendEmail({
    to,
    subject: "Your Shopfia password was changed",
    text: `Your Shopfia password was just changed. If you made this change, no action is needed. If this wasn't you, reset your password immediately: ${recoveryUrl}`,
    html: shell({title:"Your password was changed", preview:"Your Shopfia password was just changed.", body:`<p>Your Shopfia password was just changed.</p><p>If you made this change, no action is needed.</p><p>If this wasn't you, reset your password immediately to secure your account.</p>${button("Reset password", recoveryUrl)}`})
  });
}
