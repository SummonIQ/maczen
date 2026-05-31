export async function sendLicenseEmail(input: {
  to: string;
  licenseKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set. Skipping license email send.");
    return { skipped: true };
  }

  const from =
    process.env.LICENSE_EMAIL_FROM || "MacZen <support@maczen.app>";
  const subject = "Your MacZen Pro License";
  const text = [
    "Thanks for your purchase!",
    "",
    `Your License Key: ${input.licenseKey}`,
    "",
    "How to activate:",
    "1. Open MacZen",
    "2. Go to Settings > License",
    "3. Enter your license key and click Activate",
    "",
    "If you need help, reply to this email.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
      <p>Thanks for your purchase!</p>
      <p><strong>Your License Key:</strong> ${input.licenseKey}</p>
      <p><strong>How to activate:</strong></p>
      <ol>
        <li>Open MacZen</li>
        <li>Go to Settings &gt; License</li>
        <li>Enter your license key and click Activate</li>
      </ol>
      <p>If you need help, reply to this email.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${body}`);
  }

  return { skipped: false };
}
