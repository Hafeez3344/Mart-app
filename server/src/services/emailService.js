const nodemailer = require('nodemailer');

// Initialize Nodemailer Transporter
const createTransporter = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

  // If user has provided SMTP credentials, configure real SMTP transporter
  if (user && pass) {
    // If Gmail is targeted, using service: 'gmail' uses optimal secure port and settings
    if (host.includes('gmail') || user.endsWith('@gmail.com')) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass
        }
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Fallback: If no SMTP pass configured, create reusable transporter or dev handler
  return null;
};

// Check and verify live SMTP connection status
const verifySmtpConnection = async () => {
  const transporter = createTransporter();
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').trim();

  if (!user || !pass || !transporter) {
    return {
      configured: false,
      user: user || 'Not Set',
      message: 'SMTP credentials missing in server/.env (running in simulation/dev mode).'
    };
  }

  try {
    await transporter.verify();
    return {
      configured: true,
      connected: true,
      user,
      message: 'Nodemailer SMTP connected successfully!'
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      user,
      error: err.message,
      message: `Failed to connect to SMTP server: ${err.message}`
    };
  }
};

/**
 * Send Password Reset OTP / Link Email
 */
const sendPasswordResetEmail = async ({ to, name, code, resetUrl }) => {
  const from = process.env.EMAIL_FROM || '"CarePulse Hospital" <carepulse.hospital.hms@gmail.com>';
  const subject = `CarePulse HMS - Password Reset Verification Code: ${code}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f8fc; margin: 0; padding: 24px; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #b7d7f0; overflow: hidden; box-shadow: 0 4px 20px rgba(31,63,102,0.08); }
        .header { background: #1F3F66; padding: 24px; text-align: center; color: #ffffff; }
        .logo { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
        .subtitle { font-size: 12px; color: #b7d7f0; margin-top: 4px; font-weight: 600; }
        .content { padding: 32px 28px; color: #334155; }
        .greeting { font-size: 16px; font-weight: 700; color: #1F3F66; margin-bottom: 12px; }
        .text { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
        .code-box { background: #EDF6FF; border: 2px dashed #5A9BD5; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-label { font-size: 11px; font-weight: 800; color: #5A9BD5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .code { font-size: 32px; font-weight: 900; color: #1F3F66; letter-spacing: 6px; font-family: monospace; }
        .expiry { font-size: 11px; color: #64748b; margin-top: 6px; }
        .btn-container { text-align: center; margin: 24px 0; }
        .btn { display: inline-block; background: #1F3F66; color: #ffffff !important; font-weight: 800; font-size: 13px; padding: 12px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 8px rgba(31,63,102,0.25); }
        .footer { background: #EDF6FF; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #b7d7f0; }
        .warning { font-size: 11px; color: #e11d48; margin-top: 16px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">CarePulse HMS</div>
          <div class="subtitle">Hospital Management & Clinical Operations</div>
        </div>
        <div class="content">
          <div class="greeting">Hello ${name || 'User'},</div>
          <div class="text">
            We received a request to reset your login password for your CarePulse Hospital Management account (<strong>${to}</strong>).
          </div>
          
          <div class="code-box">
            <div class="code-label">Your 6-Digit Password Reset Code</div>
            <div class="code">${code}</div>
            <div class="expiry">This verification code expires in <strong>15 minutes</strong>.</div>
          </div>

          ${resetUrl ? `
          <div class="btn-container">
            <a href="${resetUrl}" class="btn" target="_blank">Reset Password Directly</a>
          </div>
          ` : ''}

          <div class="text">
            Enter this 6-digit code on the reset password screen along with your new password to restore access to your profile.
          </div>

          <div class="warning">
            If you did not request this password reset, please ignore this email or contact the hospital IT administrator immediately.
          </div>
        </div>
        <div class="footer">
          CarePulse Hospital Management System • Automated Security Alert
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n============================================================');
    console.log('📧 [NODEMAILER SIMULATION / DEV MODE]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Verification Code: [ ${code} ]`);
    if (resetUrl) console.log(`Reset URL: ${resetUrl}`);
    console.log('Note: To send real emails via Gmail, configure SMTP_PASS in server/.env');
    console.log('============================================================\n');
    return {
      success: true,
      devMode: true,
      code,
      message: 'Password reset code generated and logged (Dev Mode).'
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: `Hello ${name || 'User'},\n\nYour CarePulse password reset verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this reset, please ignore this email.`,
      html: htmlContent
    });

    console.log(`✅ Real email sent to ${to} via Nodemailer (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('⚠️ Nodemailer SMTP send error:', err.message);
    // Fallback log so user is never blocked
    console.log(`[FALLBACK CODE FOR ${to}]: ${code}`);
    return {
      success: true,
      devMode: true,
      code,
      warning: err.message,
      message: 'Code generated. SMTP warning encountered.'
    };
  }
};

/**
 * Send Password Changed Confirmation Email
 */
const sendPasswordChangedNotification = async ({ to, name }) => {
  const from = process.env.EMAIL_FROM || '"CarePulse Hospital" <carepulse.hospital.hms@gmail.com>';
  const subject = 'CarePulse HMS - Security Alert: Password Updated';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f8fc; margin: 0; padding: 24px; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #b7d7f0; overflow: hidden; }
        .header { background: #1F3F66; padding: 20px; text-align: center; color: #ffffff; }
        .content { padding: 24px; color: #334155; font-size: 13px; line-height: 1.6; }
        .alert-box { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 12px 16px; border-radius: 10px; font-weight: 700; margin-bottom: 16px; }
        .footer { background: #edf6ff; padding: 12px; text-align: center; font-size: 11px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div style="font-weight: 900; font-size: 18px;">CarePulse HMS</div>
        </div>
        <div class="content">
          <div class="alert-box">
            ✓ Your account password was successfully updated.
          </div>
          <p>Hello <strong>${name || 'User'}</strong>,</p>
          <p>This is a confirmation that the password for your account (<strong>${to}</strong>) was changed on ${new Date().toLocaleString()}.</p>
          <p>If you made this change, no further action is required.</p>
          <p style="color: #e11d48; font-weight: 600;">If you did not make this change, please immediately reset your password or alert hospital administration.</p>
        </div>
        <div class="footer">
          CarePulse Hospital Management System
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [NODEMAILER DEV MODE] Password change confirmation logged for ${to}`);
    return { success: true, devMode: true };
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text: `Hello ${name || 'User'},\n\nYour CarePulse HMS account password was successfully updated.\n\nIf you did not authorize this change, please contact administration immediately.`,
      html: htmlContent
    });
    return { success: true };
  } catch (err) {
    console.error('Nodemailer password change notification error:', err.message);
    return { success: false };
  }
};

module.exports = {
  createTransporter,
  verifySmtpConnection,
  sendPasswordResetEmail,
  sendPasswordChangedNotification
};
