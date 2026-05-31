import { NextRequest, NextResponse } from "next/server";

function sanitizeInput(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = sanitizeInput(body?.name);
    const email = sanitizeInput(body?.email);
    const message = sanitizeInput(body?.message);

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Email service is not configured." },
        { status: 500 },
      );
    }

    const from =
      process.env.RESEND_FROM_EMAIL ||
      process.env.LICENSE_EMAIL_FROM ||
      "MacZen <support@maczen.app>";

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedMessage = escapeHtml(message).replace(/\n/g, "<br />");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: ["steven@summoniq.com"],
        reply_to: email,
        subject: `MacZen contact form: ${name}`,
        text: `New contact form submission\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5;">
            <h2 style="margin-bottom: 12px;">New contact form submission</h2>
            <p><strong>Name:</strong> ${escapedName}</p>
            <p><strong>Email:</strong> ${escapedEmail}</p>
            <p><strong>Message:</strong><br />${escapedMessage}</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      console.error("Contact email send failed:", responseBody);
      return NextResponse.json(
        { error: "Unable to send message right now. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Unable to send message right now. Please try again." },
      { status: 500 },
    );
  }
}
