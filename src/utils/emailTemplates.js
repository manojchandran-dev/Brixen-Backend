// `heading` / `intro` let the same design serve other codes (e.g. app PIN reset).
function buildOtpEmail(
  otp,
  { heading = 'Verify your email', intro = 'Enter this code to continue. It expires in 10 minutes.', textIntro = 'Your Brixen verification code is' } = {}
) {
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111111;border:1px solid #262626;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td align="center" style="padding:40px 32px 24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:0;line-height:0;">
                      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                        <rect x="16" y="0" width="8" height="8" fill="#ffffff" transform="rotate(45 20 4)"/>
                        <rect x="0" y="16" width="8" height="8" fill="#ffffff" transform="rotate(45 4 20)"/>
                        <rect x="16" y="16" width="8" height="8" fill="#ffffff" transform="rotate(45 20 20)"/>
                        <rect x="32" y="16" width="8" height="8" fill="#ffffff" transform="rotate(45 36 20)"/>
                        <rect x="16" y="32" width="8" height="8" fill="#ffffff" transform="rotate(45 20 36)"/>
                      </svg>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:14px;font-size:15px;font-weight:700;letter-spacing:4px;color:#ffffff;">BRIXEN</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px;">
                <div style="font-size:20px;font-weight:700;color:#ffffff;">${heading}</div>
                <div style="margin-top:8px;font-size:14px;line-height:20px;color:#9a9a9a;">
                  ${intro}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 8px 32px;">
                <div style="display:inline-block;background-color:#000000;border:1px solid #2e2e2e;border-radius:12px;padding:16px 28px;">
                  <span style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#ffffff;">${otp}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 40px 32px;">
                <div style="font-size:13px;line-height:19px;color:#6e6e6e;">
                  If you didn't request this, you can safely ignore this email.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #1f1f1f;">
                <div style="text-align:center;font-size:12px;color:#4d4d4d;">
                  &copy; ${new Date().getFullYear()} Brixen. All rights reserved.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${textIntro} ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`;

  return { html, text };
}

// Brixen app icon, attached inline to the email by the mailer (see
// BRIXEN_ICON_CID in mailer.js) and shown with <img src="cid:...">.
const BRIXEN_ICON_CID = 'brixen-icon';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function buildWelcomeEmail(email, tempPassword) {
  const navy = '#0f2544';
  const steel = '#336a8f';
  const button = '#356d91';
  const muted = '#6b7c93';
  const body = '#44546a';
  const panel = '#f2f6f9';
  const pageBg = '#f3f6f9';
  const green = '#3f9d5b';
  const year = new Date().getFullYear();
  const font = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(tempPassword);

  const logo = (iconSize, textSize) => `
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;" valign="middle">
        <img src="cid:${BRIXEN_ICON_CID}" width="${iconSize}" height="${iconSize}" alt="Brixen" style="display:block;border:0;width:${iconSize}px;height:${iconSize}px;" />
      </td>
      <td valign="middle" style="font-family:${font};font-size:${textSize}px;font-weight:800;color:${navy};letter-spacing:-0.5px;">Brixen</td>
    </tr></table>`;

  const detailRow = (iconBg, glyph, label, value, mono) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;">
      <tr>
        <td width="84" style="padding:18px 0 18px 20px;" valign="middle">
          <table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0" style="width:56px;height:56px;background-color:${iconBg};border-radius:50%;">
            <tr><td align="center" valign="middle" style="font-size:24px;line-height:1;">${glyph}</td></tr>
          </table>
        </td>
        <td style="padding:18px 20px 18px 8px;" valign="middle">
          <div style="font-family:${font};font-size:13px;color:${muted};">${label}</div>
          <div style="margin-top:4px;font-family:${mono ? "'Consolas', 'Courier New', monospace" : font};font-size:19px;font-weight:700;color:${navy};${mono ? 'letter-spacing:1px;' : ''}word-break:break-all;">${value}</div>
        </td>
      </tr>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Brixen</title>
  </head>
  <body style="margin:0;padding:0;background-color:${pageBg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${pageBg};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:20px;">

            <!-- Header -->
            <tr>
              <td style="padding:32px 32px 20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td valign="middle">${logo(40, 28)}</td>
                  <td align="right" valign="middle" style="font-family:${font};font-size:13px;color:#7a8ca5;">HRMS for Growing Businesses</td>
                </tr></table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:0 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaf2f7;background-image:linear-gradient(120deg,#eef4f9 0%,#e6f1f3 60%,#e3f2e8 100%);border-radius:18px;">
                  <tr>
                    <td style="padding:36px 0 36px 32px;" valign="middle">
                      <div style="font-family:${font};font-size:34px;line-height:38px;font-weight:800;color:${navy};">Welcome to</div>
                      <div style="font-family:${font};font-size:34px;line-height:40px;font-weight:800;color:${steel};">Brixen</div>
                      <div style="margin-top:14px;font-family:${font};font-size:16px;line-height:24px;color:${body};">Your account has been created<br />and is ready to use.</div>
                    </td>
                    <td width="150" align="right" valign="bottom" style="padding:24px 28px 0 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td valign="bottom"><div style="width:30px;height:66px;background-color:#3d6f94;border-radius:8px 8px 0 0;"></div></td>
                        <td style="width:10px;"></td>
                        <td valign="bottom"><div style="width:30px;height:98px;background-color:#a9c9d8;border-radius:8px 8px 0 0;"></div></td>
                        <td style="width:10px;"></td>
                        <td valign="bottom"><div style="width:30px;height:138px;background-color:#9fd0b1;border-radius:8px 8px 0 0;"></div></td>
                      </tr></table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Login details -->
            <tr>
              <td style="padding:20px 20px 0 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${panel};border-radius:18px;">
                  <tr><td style="padding:28px 24px 16px 24px;font-family:${font};font-size:21px;font-weight:700;color:${navy};">Your Login Details</td></tr>
                  <tr><td style="padding:0 24px;">${detailRow('#e8f0fb', '<span style="color:#3b82f6;">&#9993;</span>', 'Email / User ID', safeEmail, false)}</td></tr>
                  <tr><td style="padding:12px 24px 0 24px;">${detailRow('#e6f4ea', '&#128274;', 'Temporary Password', safePassword, true)}</td></tr>
                  <tr>
                    <td style="padding:22px 24px 26px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${button};border-radius:10px;">
                        <tr><td align="center" style="padding:16px 20px;font-family:${font};font-size:18px;font-weight:600;color:#ffffff;">Sign in to Brixen &nbsp;&rarr;</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:16px 20px 0 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edf7f0;border-radius:14px;">
                  <tr>
                    <td width="72" align="center" valign="middle" style="padding:18px 0 18px 12px;">
                      <table role="presentation" width="36" height="36" cellpadding="0" cellspacing="0" style="width:36px;height:36px;background-color:${green};border-radius:50%;">
                        <tr><td align="center" valign="middle" style="font-family:${font};font-size:18px;font-weight:700;line-height:1;color:#ffffff;">&#10003;</td></tr>
                      </table>
                    </td>
                    <td style="padding:18px 20px 18px 14px;border-left:1px solid #d4e7da;font-family:${font};font-size:15px;line-height:22px;color:#334155;" valign="middle">
                      For your security, please change the temporary password after your first sign-in.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px 30px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e9ef;">
                  <tr>
                    <td style="padding-top:20px;" valign="middle">${logo(28, 22)}</td>
                    <td align="right" style="padding-top:20px;font-family:${font};font-size:13px;color:${muted};" valign="middle">&copy; ${year} Brixen. All rights reserved.</td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Welcome to Brixen\n\nYour account has been created and is ready to use.\n\nYour login details\nEmail / User ID: ${email}\nTemporary password: ${tempPassword}\n\nFor your security, please change the temporary password after your first sign-in.\n\n© ${year} Brixen. All rights reserved.`;

  return { html, text };
}

function buildDeactivatedEmail(email) {
  const navy = '#0f2544';
  const footerNavy = '#0c1a30';
  const green = '#16a34a';
  const red = '#dc2626';
  const redLightBg = '#fee2e2';
  const grayText = '#64748b';
  const pageBg = '#f1f5f9';
  const year = new Date().getFullYear();

  const barsLogo = (size) => `
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:${size * 0.28}px;height:${size * 0.55}px;background-color:${navy};border-radius:2px;" valign="bottom">&nbsp;</td>
      <td style="width:4px;">&nbsp;</td>
      <td style="width:${size * 0.28}px;height:${size * 0.75}px;background-color:${green};border-radius:2px;" valign="bottom">&nbsp;</td>
      <td style="width:4px;">&nbsp;</td>
      <td style="width:${size * 0.28}px;height:${size}px;background-color:#38bdf8;border-radius:2px;" valign="bottom">&nbsp;</td>
    </tr></table>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${pageBg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${pageBg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

            <!-- Header -->
            <tr>
              <td style="padding:28px 32px 20px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:10px;">${barsLogo(22)}</td>
                  <td style="font-size:22px;font-weight:800;color:${navy};">Brixen</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background-color:${red};">&nbsp;</td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${redLightBg};border-radius:20px;">
                  <tr><td style="padding:6px 14px;font-size:12px;font-weight:700;color:${red};">&#9679;&nbsp; Account Deactivated</td></tr>
                </table>
                <div style="margin-top:16px;font-size:26px;line-height:32px;font-weight:800;color:${navy};">Your account has been deactivated</div>
                <div style="margin-top:12px;font-size:14px;line-height:22px;color:${grayText};">
                  Access to your Brixen account for <strong style="color:${navy};">${email}</strong> has been turned off. You won't be able to sign in until it's reactivated by your administrator.
                </div>
              </td>
            </tr>

            <!-- Support -->
            <tr>
              <td style="padding:24px 32px 32px 32px;border-top:1px solid #e2e8f0;margin-top:16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
                  <td style="font-size:16px;color:${grayText};padding-right:12px;">&#127911;</td>
                  <td style="font-size:13px;line-height:19px;color:${grayText};">
                    If you believe this is a mistake, please <a href="mailto:support@brixen.app" style="color:${green};font-weight:700;text-decoration:none;">contact our support team</a>.
                  </td>
                </tr></table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:${footerNavy};padding:22px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="padding-right:10px;">${barsLogo(16)}</td>
                        <td style="font-size:12px;color:#c7d2e3;">Better insights. A brighter tomorrow.</td>
                      </tr></table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #16294a;">
                  <tr><td style="padding-top:14px;text-align:center;font-size:12px;color:#8fa0bd;">&copy; ${year} Brixen. All rights reserved.</td></tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Your Brixen account has been deactivated.\n\nAccess for ${email} has been turned off. You won't be able to sign in until it's reactivated by your administrator.\n\nIf you believe this is a mistake, please contact our support team.`;

  return { html, text };
}

module.exports = { buildOtpEmail, buildWelcomeEmail, buildDeactivatedEmail, BRIXEN_ICON_CID };
