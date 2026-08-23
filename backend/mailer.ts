import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

const wrapper = (title: string, bodyHtml: string) => `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f8fafc; padding: 32px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background: #1e293b; padding: 24px; text-align: center;">
      <div style="color: #ffffff; font-weight: 700; font-size: 18px; letter-spacing: -0.02em;">WayCar</div>
    </div>
    <div style="padding: 28px 24px;">
      <h1 style="font-size: 18px; color: #0f172a; margin: 0 0 12px;">${title}</h1>
      ${bodyHtml}
    </div>
  </div>
</div>`;

const button = (href: string, text: string) => `
  <a href="${href}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 12px; margin-top: 8px;">${text}</a>`;

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    console.warn(`[mailer] SMTP не настроен — письмо для ${to} не отправлено ("${subject}")`);
    return;
  }
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
  } catch (err: any) {
    console.error(`[mailer] Не удалось отправить письмо для ${to}:`, err.message);
  }
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${APP_URL}/?verifyEmail=${token}`;
  const html = wrapper('Подтвердите email', `
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">Здравствуйте, ${name}! Подтвердите свой email, чтобы начать пользоваться WayCar.</p>
    ${button(link, 'Подтвердить email')}
    <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Ссылка действует 24 часа. Если вы не регистрировались в WayCar — просто проигнорируйте это письмо.</p>
  `);
  await send(to, 'Подтверждение email — WayCar', html);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${APP_URL}/?resetPassword=${token}`;
  const html = wrapper('Сброс пароля', `
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">Здравствуйте, ${name}! Мы получили запрос на сброс пароля для вашего аккаунта.</p>
    ${button(link, 'Установить новый пароль')}
    <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Ссылка действует 1 час. Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
  `);
  await send(to, 'Сброс пароля — WayCar', html);
}
