const { Resend } = require('resend');
const { RESEND_API_KEY, RESEND_FROM_EMAIL } = require('../config');
const { buildOtpEmail, buildWelcomeEmail, buildDeactivatedEmail } = require('./emailTemplates');

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send(payload) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(`Failed to send email: ${error.message || error.name || JSON.stringify(error)}`);
  }
  return data;
}

async function sendOtpEmail(to, otp) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const { html, text } = buildOtpEmail(otp);

  await send({
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

  await send({
    from: RESEND_FROM_EMAIL,
    to,
    subject: 'Welcome to Brixen — your account is activated',
    html,
    text,
  });
}

async function sendDeactivationEmail(to, email) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const { html, text } = buildDeactivatedEmail(email);

  await send({
    from: RESEND_FROM_EMAIL,
    to,
    subject: 'Your Brixen account has been deactivated',
    html,
    text,
  });
}

module.exports = { sendOtpEmail, sendWelcomeEmail, sendDeactivationEmail };
