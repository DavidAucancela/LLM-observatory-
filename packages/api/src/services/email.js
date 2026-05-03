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
const API_URL = process.env.API_URL    || 'http://localhost:3001';

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

// ── sendActivationEmail ───────────────────────────────────────────────────────
async function sendActivationEmail(to, token) {
  const link = `${API_URL}/api/auth/activate?token=${token}`;

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

  const { error } = await getResend().emails.send({
    from:    FROM,
    to,
    subject: 'Activa tu cuenta — LLM Observatory',
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── sendPasswordResetEmail ────────────────────────────────────────────────────
async function sendPasswordResetEmail(to, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;

  const html = base(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Restablecer contraseña</h2>
    <p style="color:#475569;margin:0 0 4px;font-size:14px;line-height:1.6">
      Recibimos una solicitud para restablecer la contraseña de
      <strong>${to}</strong>.
    </p>
    <p style="color:#475569;margin:0;font-size:14px;line-height:1.6">
      Este link expira en <strong>1 hora</strong>.
      Si no lo solicitaste, ignora este email.
    </p>
    ${btn(link, 'Cambiar contraseña')}
    ${linkNote(link)}
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;
                padding:12px 16px;margin-top:16px">
      <p style="margin:0;color:#713f12;font-size:12px">
        ⚠️ Por seguridad nunca compartas este link con nadie.
      </p>
    </div>
  `);

  if (!process.env.RESEND_API_KEY) {
    logEmailToConsole('Restablece tu contraseña — LLM Observatory', to, link);
    return;
  }

  const { error } = await getResend().emails.send({
    from:    FROM,
    to,
    subject: 'Restablece tu contraseña — LLM Observatory',
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

module.exports = { sendActivationEmail, sendPasswordResetEmail };
