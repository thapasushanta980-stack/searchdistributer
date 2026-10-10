import nodemailer from "nodemailer";
import { config } from "../../config.js";
import { logger } from "../../logger.js";

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
  : null;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (!transport) {
    // Development fallback: no SMTP configured, so surface the message in the server log.
    logger.info(`[mail:dev] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return;
  }
  await transport.sendMail({ from: config.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
}
