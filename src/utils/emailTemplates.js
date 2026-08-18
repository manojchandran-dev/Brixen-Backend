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

module.exports = { buildOtpEmail };
