const { Resend } = require('resend');
const { RESEND_API_KEY, RESEND_FROM_EMAIL } = require('../config');
const fs = require('fs');
const path = require('path');
const { buildOtpEmail, buildWelcomeEmail, buildDeactivatedEmail, BRIXEN_ICON_CID } = require('./emailTemplates');

// The app icon, embedded in the email itself (inline attachment) rather than
// linked, so it shows even when the server is asleep or images are proxied.
const BRIXEN_ICON = fs.readFileSync(path.join(__dirname, '../assets/brixen-icon.png'));

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send(payload) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(`Failed to send email: ${error.message || error.name || JSON.stringify(error)}`);
  }
  return data;
}

// Employee login and account-setup emails are plain text: no HTML, no
// design (`plain: true`).
async function sendOtpEmail(to, otp, { plain = false } = {}) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const subject = 'Your Brixen verification code';
  if (plain) {
    await send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      text: `Your Brixen verification code is ${otp}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.\n`,
    });
    return;
  }

  const { html, text } = buildOtpEmail(otp);

  await send({
    from: RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
  });
}

// Code for resetting the app's lock-screen PIN (not the password).
async function sendPinResetOtpEmail(to, otp, { plain = false } = {}) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const subject = 'Your Brixen PIN reset code';
  if (plain) {
    await send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      text: `Your Brixen app PIN reset code is ${otp}\n\nIt expires in 10 minutes. Your password is not changed. If you didn't ask for it, you can ignore this email.\n`,
    });
    return;
  }

  const { html, text } = buildOtpEmail(otp, {
    heading: 'Reset your app PIN',
    intro: 'Use this code to reset the PIN you use to unlock the Brixen app. It expires in 10 minutes. Your password is not changed.',
    textIntro: 'Your Brixen app PIN reset code is',
  });

  await send({ from: RESEND_FROM_EMAIL, to, subject, html, text });
}

// An employee's sign-in details after their company admin activates them.
// Plain text. The temporary password is only in this email -- it's never
// stored or logged; the employee must set their own at first sign-in.
async function sendEmployeeSetupEmail(to, { name, companyName, tempPassword }) {
  if (!resend) {
    throw new Error('Email is not set up on the server (RESEND_API_KEY is missing)');
  }
  const text = [
    `Hello ${name},`,
    '',
    `${companyName || 'Your company'} has set up your Brixen account.`,
    '',
    `Email: ${to}`,
    `Temporary password: ${tempPassword}`,
    '',
    'Sign in to the Brixen app with these details. You will be asked to choose your own password straight away.',
    '',
    "If you weren't expecting this, contact your company admin.",
    '',
  ].join('\n');
  await send({ from: RESEND_FROM_EMAIL, to, subject: 'Your Brixen account', text });
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
    attachments: [{ filename: 'brixen-icon.png', content: BRIXEN_ICON, contentId: BRIXEN_ICON_CID }],
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

const rupees = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// One employee's payslip for a month (payroll/service shapeSlip), plain text
// like the other employee emails.
async function sendPayslipEmail(to, { slip, typeLabel, companyName }) {
  if (!resend) {
    throw new Error('Email is not set up on the server (RESEND_API_KEY is missing)');
  }
  // "October 2026", or a week: "26 Oct – 1 Nov 2026".
  const monthName = slip.period_label ?? slip.month;
  const per = {
    SHIFT_RATE: 'per shift',
    PIECE_RATE: slip.salary_period === 'PER_DOZEN' ? 'per dozen' : 'per piece',
    HOURLY: 'per hour',
    WEEKLY: 'per week',
    MONTHLY: 'per month',
  }[slip.salary_type];
  const worked = {
    SHIFT_RATE: `Shifts worked: ${qty(slip.units)}`,
    PIECE_RATE: `Pieces sold: ${qty(slip.units)}`,
    HOURLY: `Hours worked: ${qty(slip.units)}`,
    WEEKLY: `Days worked: ${qty(slip.units)}`,
    MONTHLY: `Days worked: ${qty(slip.units)} of ${slip.working_days}`,
  }[slip.salary_type];
  const text = [
    `Hello ${slip.employee.name},`,
    '',
    `Here is your payslip for ${monthName} from ${companyName || 'your company'}.`,
    '',
    `Employee ID: ${slip.employee.employee_code ?? '-'}`,
    `Salary type: ${typeLabel}${slip.rate !== null && per ? ` (${rupees(slip.rate)} ${per})` : ''}`,
    `Days present: ${qty(slip.days_present)}`,
    ...(worked ? [worked] : []),
    ...(slip.breakdown ?? []).map((l) => `  ${l.name}: ${qty(l.quantity)} x ${rupees(l.rate)} = ${rupees(l.amount)}`),
    '',
    `Earned: ${rupees(slip.gross)}`,
    ...(slip.additions > 0 ? [`Additions: ${rupees(slip.additions)}`] : []),
    ...(slip.deductions > 0 ? [`Deductions: ${rupees(slip.deductions)}`] : []),
    `Net pay: ${rupees(slip.net)}`,
    ...(slip.notes ? ['', `Note: ${slip.notes}`] : []),
    '',
    'You can also see your payslips in the Brixen app, under My Work.',
    '',
  ].join('\n');
  await send({ from: RESEND_FROM_EMAIL, to, subject: `Your payslip for ${monthName}`, text });
}

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendDeactivationEmail,
  sendPinResetOtpEmail,
  sendEmployeeSetupEmail,
  sendPayslipEmail,
};
