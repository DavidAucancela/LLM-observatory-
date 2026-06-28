const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function logEmailToConsole(subject, to, link) {
  const SEP = '═'.repeat(60);
  console.log(`\n${SEP}`);
  console.log(`  📧  EMAIL (modo consola — RESEND_API_KEY no configurado)`);
  console.log(`${SEP}`);
  console.log(`  Para:    ${to}`);
  console.log(`  Asunto:  ${subject}`);
  console.log(`  Link:    ${link}`);
  console.log(`${SEP}\n`);
}

const FROM    = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL    || 'http://localhost:5173';

// ── Shared styles ─────────────────────────────────────────────────────────────
const base = (content) => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:24px 32px">
            <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px">
              🔭 LLM Observatory
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5">
              LLM Observatory · AI Cost Tracker<br>
              Si no reconoces esta actividad, ignora este email de forma segura.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (href, text) =>
  `<a href="${href}"
      style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
             padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;
             margin:20px 0">${text}</a>`;

const linkNote = (href) =>
  `<p style="color:#94a3b8;font-size:12px;margin-top:20px;word-break:break-all">
     O copia este link en tu navegador:<br>
     <span style="color:#64748b">${href}</span>
   </p>`;

// ── sendWithFallback ──────────────────────────────────────────────────────────
// Tries sending with the configured FROM address. If Resend rejects it due to
// an unverified custom domain, automatically retries with onboarding@resend.dev
// (Resend's own verified domain, usable on any account without domain setup).
async function sendWithFallback({ to, subject, html }) {
  const FALLBACK_FROM = 'onboarding@resend.dev';

  const attempt = async (from) => {
    const { error } = await getResend().emails.send({ from, to, subject, html });
    if (error) throw new Error(`Resend error: ${error.message}`);
  };

  try {
    await attempt(FROM);
  } catch (err) {
    // Retry with Resend's own verified domain if the custom one isn't verified yet
    if (FROM !== FALLBACK_FROM && err.message.includes('domain')) {
      await attempt(FALLBACK_FROM);
    } else {
      throw err;
    }
  }
}

// ── sendActivationEmail ───────────────────────────────────────────────────────
async function sendActivationEmail(to, token) {
  const link = `${APP_URL}/api/auth/activate?token=${token}`;

  const html = base(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Activa tu cuenta</h2>
    <p style="color:#475569;margin:0 0 4px;font-size:14px;line-height:1.6">
      Hola, gracias por registrarte en <strong>LLM Observatory</strong>.
    </p>
    <p style="color:#475569;margin:0;font-size:14px;line-height:1.6">
      Haz clic en el botón de abajo para activar tu cuenta.
      Este link expira en <strong>24 horas</strong>.
    </p>
    ${btn(link, 'Activar cuenta')}
    ${linkNote(link)}
  `);

  if (!process.env.RESEND_API_KEY) {
    logEmailToConsole('Activa tu cuenta — LLM Observatory', to, link);
    return;
  }

  await sendWithFallback({ to, subject: 'Activa tu cuenta — LLM Observatory', html });
}

// ── sendPasswordResetEmail ────────────────────────────────────────────────────
async function sendPasswordResetEmail(to, token) {
  const link        = `${APP_URL}/reset-password?token=${token}`;
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = base(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Solicitud de restablecimiento de contraseña</h2>
    <p style="color:#475569;margin:0 0 4px;font-size:14px;line-height:1.6">
      El usuario <strong>${to}</strong> ha solicitado restablecer su contraseña.
    </p>
    <p style="color:#475569;margin:0;font-size:14px;line-height:1.6">
      Este link expira en <strong>1 hora</strong>.
    </p>
    ${btn(link, 'Restablecer contraseña')}
    ${linkNote(link)}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                padding:12px 16px;margin-top:16px">
      <p style="margin:0;color:#14532d;font-size:12px">
        Comparte este link de forma segura con el usuario que lo solicitó.
      </p>
    </div>
  `);

  if (!process.env.RESEND_API_KEY) {
    logEmailToConsole('Reset solicitado por: ' + to, supportEmail, link);
    return;
  }

  await sendWithFallback({ to: supportEmail, subject: `[Soporte] Reset de contraseña para ${to}`, html });
}

// ── sendInviteEmail ───────────────────────────────────────────────────────────
async function sendInviteEmail(to, token, orgName) {
  const link = `${APP_URL}/accept-invite?token=${token}`;

  const html = base(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Invitación a ${orgName}</h2>
    <p style="color:#475569;margin:0 0 4px;font-size:14px;line-height:1.6">
      Has sido invitado a unirte a <strong>${orgName}</strong> en LLM Observatory.
    </p>
    <p style="color:#475569;margin:0;font-size:14px;line-height:1.6">
      Haz clic en el botón para aceptar. Este link expira en <strong>7 días</strong>.
    </p>
    ${btn(link, 'Aceptar invitación')}
    ${linkNote(link)}
  `);

  if (!process.env.RESEND_API_KEY) {
    logEmailToConsole(`Invitación a ${orgName} — LLM Observatory`, to, link);
    return;
  }

  await sendWithFallback({ to, subject: `Invitación a ${orgName} — LLM Observatory`, html });
}

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendInviteEmail };
