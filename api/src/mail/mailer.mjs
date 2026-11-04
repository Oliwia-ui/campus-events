import nodemailer from 'nodemailer';

// Builds the nodemailer transport once. Without an SMTP host (local development, tests)
// nodemailer's jsonTransport builds the mail without sending it, so nothing leaves your laptop.
export function createMailer(config, logger) {
  const transport = config.host
    ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
      auth: { user: config.user, pass: config.pass },
      // Fail fast instead of hanging when the mail server is down; the outbox retries later.
      connectionTimeout: 10_000,
      socketTimeout: 10_000
    })
    : nodemailer.createTransport({ jsonTransport: true });

  return {
    async send({ to, subject, text }) {
      const info = await transport.sendMail({ from: config.from, to, subject, text });
      // Ethereal (the free test inbox) gives a link to view the mail in the browser.
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      logger.info(config.host ? 'mail sent' : 'mail built (SMTP not configured, not sent)', {
        messageId: info.messageId,
        previewUrl
      });
      return info;
    }
  };
}
