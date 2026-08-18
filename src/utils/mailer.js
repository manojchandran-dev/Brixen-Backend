const { Resend } = require('resend');
const { RESEND_API_KEY, RESEND_FROM_EMAIL } = require('../config');
const { buildOtpEmail } = require('./emailTemplates');

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendOtpEmail(to, otp) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const { html, text } = buildOtpEmail(otp);

  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to,
    subject: 'Your Brixen verification code',
    html,
    text,
  });
}

module.exports = { sendOtpEmail };
