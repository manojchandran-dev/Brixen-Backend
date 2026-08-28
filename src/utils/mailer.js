const { Resend } = require('resend');
const { RESEND_API_KEY, RESEND_FROM_EMAIL } = require('../config');
const { buildOtpEmail, buildWelcomeEmail } = require('./emailTemplates');

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

async function sendWelcomeEmail(to, email, tempPassword) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const { html, text } = buildWelcomeEmail(email, tempPassword);

  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to,
    subject: 'Welcome to Brixen — your account is activated',
    html,
    text,
  });
}

module.exports = { sendOtpEmail, sendWelcomeEmail };
