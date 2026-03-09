/**
 * Email sending: Resend (HTTP API, recommended on Vercel) or Nodemailer (SMTP).
 * Set RESEND_API_KEY or SMTP_* in .env. On Vercel, Resend avoids "Unexpected socket close" with SMTP.
 */
import nodemailer from "nodemailer";

const BASE_URL = (process.env.BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const MAIL_FROM = process.env.MAIL_FROM || process.env.RESEND_FROM || '"SignFlow" <noreply@localhost>';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const auth =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    pool: false,
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
}

async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM || process.env.MAIL_FROM || "onboarding@resend.dev";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Mail] Resend error:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Mail] Resend request failed:", err);
    return false;
  }
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

export interface SigningLinkPayload {
  signerName: string;
  signerEmail: string;
  documentName: string;
  signToken: string;
}

export async function sendSigningLink(payload: SigningLinkPayload): Promise<boolean> {
  const signUrl = `${BASE_URL}/sign/${payload.signToken}`;
  const subject = `Document à signer : ${payload.documentName}`;
  const text = `
Bonjour ${payload.signerName},

Vous êtes invité à signer le document : ${payload.documentName}.

Cliquez sur le lien ci-dessous pour accéder à la page de signature :

${signUrl}

Ce lien est personnel et sécurisé.
  `.trim();
  const html = `
<p>Bonjour <strong>${payload.signerName}</strong>,</p>
<p>Vous êtes invité à signer le document : <strong>${payload.documentName}</strong>.</p>
<p><a href="${signUrl}" style="display:inline-block; padding:12px 24px; background:#0f172a; color:#fff; text-decoration:none; border-radius:9999px;">Ouvrir la page de signature</a></p>
<p style="color:#64748b; font-size:12px;">Ou copiez ce lien : <br/><a href="${signUrl}">${signUrl}</a></p>
<p style="color:#64748b; font-size:12px;">Ce lien est personnel et sécurisé.</p>
  `.trim();

  if (process.env.RESEND_API_KEY) {
    const ok = await sendViaResend(payload.signerEmail, subject, text, html);
    if (ok) return true;
    console.error("[Mail] Resend failed for signing link, fallback to SMTP if configured");
  }
  const transporter = getTransporter();
  if (!transporter) {
    console.log("[Mail] No mail configured. Sign link:", signUrl);
    return false;
  }
  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: payload.signerEmail,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Mail] Failed to send signing link to", payload.signerEmail, err);
    return false;
  }
}

export async function sendSignedPdfLink(payload: {
  signerEmail: string;
  signerName: string;
  documentName: string;
  downloadUrl: string;
}): Promise<boolean> {
  const subject = `Document signé : ${payload.documentName}`;
  const text = `
Bonjour ${payload.signerName},

Le document "${payload.documentName}" a été signé par tous les signataires.

Téléchargez votre copie ici : ${payload.downloadUrl}
  `.trim();
  const html = `
<p>Bonjour <strong>${payload.signerName}</strong>,</p>
<p>Le document <strong>${payload.documentName}</strong> a été signé par tous les signataires.</p>
<p><a href="${payload.downloadUrl}" style="display:inline-block; padding:12px 24px; background:#0f172a; color:#fff; text-decoration:none; border-radius:9999px;">Télécharger le PDF signé</a></p>
  `.trim();

  if (process.env.RESEND_API_KEY) {
    const ok = await sendViaResend(payload.signerEmail, subject, text, html);
    if (ok) return true;
  }
  const transporter = getTransporter();
  if (!transporter) {
    console.log("[Mail] No mail configured. Signed PDF download:", payload.downloadUrl);
    return false;
  }
  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: payload.signerEmail,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Mail] Failed to send signed PDF link to", payload.signerEmail, err);
    return false;
  }
}
