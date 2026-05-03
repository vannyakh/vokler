import nodemailer from "nodemailer";

/** True when Gmail (or other SMTP) is configured for transactional mail. */
export function canSendTransactionalEmail(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

function createTransport() {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

export async function sendVerificationEmailMessage(to: string, verifyUrl: string): Promise<void> {
  const from =
    process.env.EMAIL_FROM?.trim() ||
    `Vokler <${process.env.SMTP_USER}>`;
  const transport = createTransport();
  await transport.sendMail({
    from,
    to,
    subject: "Verify your email for Vokler",
    text: `Open this link to verify your email address:\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this message.`,
    html: `<p>Verify your email for <strong>Vokler</strong>.</p><p><a href="${verifyUrl}">Verify email</a></p><p style="color:#666;font-size:12px">If you did not create an account, you can ignore this message.</p>`,
  });
}
