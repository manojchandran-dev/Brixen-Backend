function buildOtpEmail(otp) {
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
                <div style="font-size:20px;font-weight:700;color:#ffffff;">Verify your email</div>
                <div style="margin-top:8px;font-size:14px;line-height:20px;color:#9a9a9a;">
                  Enter this code to continue. It expires in 10 minutes.
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

  const text = `Your Brixen verification code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`;

  return { html, text };
}

function buildWelcomeEmail(email, tempPassword) {
  const navy = '#0f2544';
  const footerNavy = '#0c1a30';
  const green = '#16a34a';
  const greenLightBg = '#e8f8ee';
  const blue = '#2563eb';
  const lightBlue = '#38bdf8';
  const grayText = '#64748b';
  const pageBg = '#f1f5f9';
  const borderGray = '#e2e8f0';
  const year = new Date().getFullYear();

  const barsLogo = (size) => `
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:${size * 0.28}px;height:${size * 0.55}px;background-color:${navy};border-radius:2px;" valign="bottom">&nbsp;</td>
      <td style="width:4px;">&nbsp;</td>
      <td style="width:${size * 0.28}px;height:${size * 0.75}px;background-color:${green};border-radius:2px;" valign="bottom">&nbsp;</td>
      <td style="width:4px;">&nbsp;</td>
      <td style="width:${size * 0.28}px;height:${size}px;background-color:${lightBlue};border-radius:2px;" valign="bottom">&nbsp;</td>
    </tr></table>`;

  const featureIcon = (bg, glyph, title, subtitle) => `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
      <tr><td align="center">
        <table role="presentation" width="44" height="44" cellpadding="0" cellspacing="0" style="width:44px;height:44px;background-color:${bg};border-radius:50%;">
          <tr><td align="center" valign="middle" style="font-size:18px;line-height:1;color:#ffffff;">${glyph}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding-top:10px;font-size:13px;font-weight:700;color:${navy};">${title}</td></tr>
      <tr><td align="center" style="font-size:12px;color:${grayText};">${subtitle}</td></tr>
    </table>`;

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
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="padding-right:10px;">${barsLogo(22)}</td>
                        <td style="font-size:22px;font-weight:800;color:${navy};">Brixen</td>
                      </tr></table>
                    </td>
                    <td align="right" valign="middle" style="font-size:12px;color:${grayText};">
                      Smarter &nbsp;&middot;&nbsp; Simpler &nbsp;&middot;&nbsp; Together
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background-color:${green};background:linear-gradient(90deg, ${green} 0%, ${blue} 100%);">&nbsp;</td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="top" style="width:62%;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:${greenLightBg};border-radius:20px;">
                        <tr><td style="padding:6px 14px;font-size:12px;font-weight:700;color:${green};">&#9679;&nbsp; Account Activated</td></tr>
                      </table>
                      <div style="margin-top:16px;font-size:30px;line-height:36px;font-weight:800;color:${navy};">Welcome back!</div>
                      <div style="margin-top:4px;font-size:17px;font-weight:700;color:${green};">Your account is now active.</div>
                      <div style="margin-top:12px;font-size:14px;line-height:22px;color:${grayText};">
                        Great news! Your Brixen account has been successfully activated and you're ready to get started.
                      </div>
                    </td>
                    <td valign="top" align="right" style="width:38%;padding-left:12px;">
                      <table role="presentation" width="140" height="120" cellpadding="0" cellspacing="0" style="background-color:${pageBg};border-radius:24px;">
                        <tr><td align="center" valign="middle">${barsLogo(56)}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Login details -->
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${pageBg};border-radius:16px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <div style="font-size:16px;font-weight:800;color:${navy};">Your login details</div>
                      <div style="margin-top:2px;font-size:13px;color:${grayText};">Use the credentials below to sign in to your Brixen account.</div>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background-color:#ffffff;border:1px solid ${borderGray};border-radius:12px;">
                        <tr>
                          <td style="padding:16px 18px;border-bottom:1px solid ${borderGray};">
                            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                              <td style="width:36px;">
                                <table role="presentation" width="32" height="32" cellpadding="0" cellspacing="0" style="width:32px;height:32px;background-color:${greenLightBg};border-radius:50%;">
                                  <tr><td align="center" valign="middle" style="font-size:14px;color:${green};">&#9993;</td></tr>
                                </table>
                              </td>
                              <td style="padding-left:12px;">
                                <div style="font-size:11px;color:${grayText};text-transform:uppercase;letter-spacing:0.5px;">Email ID</div>
                                <div style="margin-top:2px;font-size:15px;font-weight:700;color:${navy};">${email}</div>
                              </td>
                            </tr></table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:16px 18px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                              <td style="width:36px;" valign="top">
                                <table role="presentation" width="32" height="32" cellpadding="0" cellspacing="0" style="width:32px;height:32px;background-color:#dbeafe;border-radius:50%;">
                                  <tr><td align="center" valign="middle" style="font-size:14px;color:${blue};">&#128274;</td></tr>
                                </table>
                              </td>
                              <td style="padding-left:12px;" valign="top">
                                <div style="font-size:11px;color:${grayText};text-transform:uppercase;letter-spacing:0.5px;">Password</div>
                                <div style="margin-top:2px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:16px;font-weight:700;color:${navy};letter-spacing:1px;">${tempPassword}</div>
                              </td>
                              <td align="right" valign="top" style="font-size:14px;color:${grayText};">&#128065;</td>
                            </tr></table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td align="center" style="padding:28px 32px 4px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:${green};border-radius:10px;">
                      <div style="padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;">Explore Brixen &nbsp;&rarr;</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:12px;font-size:13px;color:${grayText};">Sign in now and explore everything Brixen has to offer.</div>
              </td>
            </tr>

            <!-- Feature grid -->
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="25%" align="center">${featureIcon(navy, '&#128200;', 'Track', 'Your progress')}</td>
                    <td width="25%" align="center">${featureIcon(green, '&#10003;', 'Manage', 'Your tasks')}</td>
                    <td width="25%" align="center">${featureIcon(blue, '&#128101;', 'Collaborate', 'With your team')}</td>
                    <td width="25%" align="center">${featureIcon(lightBlue, '&#9889;', 'Achieve', 'More together')}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Security notice -->
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${greenLightBg};border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="font-size:16px;color:${green};padding-right:12px;">&#128737;</td>
                        <td style="font-size:13px;line-height:19px;color:${navy};">
                          For your security, we recommend changing your password after your first login.
                        </td>
                      </tr></table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Support -->
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid ${borderGray};margin-top:16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
                  <td style="font-size:16px;color:${grayText};padding-right:12px;">&#127911;</td>
                  <td style="font-size:13px;line-height:19px;color:${grayText};">
                    If you didn't create this account,<br />please <a href="mailto:support@brixen.app" style="color:${green};font-weight:700;text-decoration:none;">contact our support team</a> immediately.
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
                    <td align="right" valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="width:28px;height:28px;background-color:#16294a;border-radius:50%;text-align:center;font-size:12px;color:#c7d2e3;" valign="middle">in</td>
                        <td style="width:8px;">&nbsp;</td>
                        <td style="width:28px;height:28px;background-color:#16294a;border-radius:50%;text-align:center;font-size:12px;color:#c7d2e3;" valign="middle">&#128038;</td>
                        <td style="width:8px;">&nbsp;</td>
                        <td style="width:28px;height:28px;background-color:#16294a;border-radius:50%;text-align:center;font-size:12px;color:#c7d2e3;" valign="middle">&#9993;</td>
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

  const text = `Welcome back! Your Brixen account is now active.\n\nYour login details:\nEmail ID: ${email}\nPassword: ${tempPassword}\n\nFor your security, we recommend changing your password after your first login.\n\nIf you didn't create this account, please contact our support team immediately.`;

  return { html, text };
}

module.exports = { buildOtpEmail, buildWelcomeEmail };
