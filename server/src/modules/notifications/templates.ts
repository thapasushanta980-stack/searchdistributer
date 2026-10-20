import { config } from "../../config.js";
import type { MailMessage } from "./mailer.js";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);

const shell = (title: string, bodyHtml: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#111827;line-height:1.55"><h2 style="margin:0 0 16px">${esc(title)}</h2>${bodyHtml}<p style="color:#64748B;font-size:12px;margin-top:32px">${esc(config.SITE_NAME)}</p></div>`;

type Payload = Record<string, string | undefined>;

export function renderTemplate(template: string, to: string, p: Payload): MailMessage {
  switch (template) {
    case "enquiry-verify": {
      const link = `${config.siteUrl}/enquiries/verify?token=${encodeURIComponent(p.token ?? "")}`;
      return {
        to,
        subject: `Confirm your enquiry to ${p.distributorName}`,
        text: `Hello ${p.senderName},\n\nConfirm your email so ${p.distributorName} can receive your enquiry (reference ${p.reference}):\n${link}\n\nThe link expires in 24 hours. If you did not send this enquiry you can ignore this email.`,
        html: shell(
          "Confirm your enquiry",
          `<p>Hello ${esc(p.senderName)},</p><p>Confirm your email so <strong>${esc(p.distributorName)}</strong> can receive your enquiry (reference <strong>${esc(p.reference)}</strong>).</p><p><a href="${esc(link)}" style="background:#3156D3;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;display:inline-block">Confirm email</a></p><p style="color:#64748B;font-size:13px">The link expires in 24 hours. If you did not send this enquiry you can ignore this email.</p>`,
        ),
      };
    }
    case "enquiry-confirmation":
      return {
        to,
        subject: `Enquiry ${p.reference} sent to ${p.distributorName}`,
        text: `Hello ${p.senderName},\n\nYour enquiry (reference ${p.reference}) has been delivered to ${p.distributorName}. They may contact you using the details you provided. An enquiry is not an order or a guarantee of a reply.`,
        html: shell(
          "Enquiry delivered",
          `<p>Hello ${esc(p.senderName)},</p><p>Your enquiry (reference <strong>${esc(p.reference)}</strong>) has been delivered to <strong>${esc(p.distributorName)}</strong>. They may contact you using the details you provided.</p><p style="color:#64748B;font-size:13px">An enquiry is not an order or a guarantee of a reply.</p>`,
        ),
      };
    case "enquiry-brand":
      return {
        to,
        subject: `New enquiry ${p.reference} for ${p.distributorName}`,
        text: `New enquiry ${p.reference} for ${p.distributorName}\n\nFrom: ${p.senderName} <${p.senderEmail}>\nPhone: ${p.senderPhone || "-"}\nLocation: ${p.senderLocation}\n\n${p.message}`,
        html: shell(
          `New enquiry for ${p.distributorName}`,
          `<p><strong>Reference:</strong> ${esc(p.reference)}</p><p><strong>From:</strong> ${esc(p.senderName)} &lt;${esc(p.senderEmail)}&gt;<br><strong>Phone:</strong> ${esc(p.senderPhone || "-")}<br><strong>Location:</strong> ${esc(p.senderLocation)}</p><blockquote style="border-left:3px solid #E2E8F0;margin:0;padding-left:12px;white-space:pre-wrap">${esc(p.message)}</blockquote>`,
        ),
      };
    case "requirement-response":
      return {
        to,
        subject: `New enquiry about your requirement: ${p.requirementTitle}`,
        text: `A business responded to your requirement "${p.requirementTitle}" (reference ${p.reference}).\n\nFrom: ${p.senderName} <${p.senderEmail}>\nPhone: ${p.senderPhone || "-"}\nLocation: ${p.senderLocation}\n\n${p.message}`,
        html: shell(
          "Someone responded to your requirement",
          `<p><strong>${esc(p.requirementTitle)}</strong> (reference ${esc(p.reference)})</p><p><strong>From:</strong> ${esc(p.senderName)} &lt;${esc(p.senderEmail)}&gt;<br><strong>Phone:</strong> ${esc(p.senderPhone || "-")}<br><strong>Location:</strong> ${esc(p.senderLocation)}</p><blockquote style="border-left:3px solid #E2E8F0;margin:0;padding-left:12px;white-space:pre-wrap">${esc(p.message)}</blockquote>`,
        ),
      };
    case "lead-internal":
      return {
        to,
        subject: `New ${(p.type ?? "").toLowerCase().replace("_", " ")} ${p.reference}`,
        text: `${p.type} ${p.reference}\n\n${p.name} <${p.email ?? "no email"}> ${p.phone ?? ""}\nCompany: ${p.companyName ?? "-"}\nCategory: ${p.categorySlug ?? "-"}\nLocation: ${p.location ?? "-"}\n\n${p.message}`,
        html: shell(
          `New ${p.type}`,
          `<p>${esc(p.name)} &lt;${esc(p.email ?? "no email")}&gt;<br>Phone: ${esc(p.phone ?? "-")}<br>Company: ${esc(p.companyName ?? "-")}</p><blockquote style="white-space:pre-wrap">${esc(p.message)}</blockquote>`,
        ),
      };
    default:
      throw new Error(`Unknown mail template: ${template}`);
  }
}
