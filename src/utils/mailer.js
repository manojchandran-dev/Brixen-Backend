const { Resend } = require('resend');
const { RESEND_API_KEY, RESEND_FROM_EMAIL } = require('../config');

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendOtpEmail(to, otp) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to,
    subject: 'Your Brixen verification code',
    html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
