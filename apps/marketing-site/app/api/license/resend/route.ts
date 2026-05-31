import { NextRequest, NextResponse } from "next/server";
import {
  getLatestLicenseByEmail,
  getLicenseByKey,
  getLicenseBySessionId,
  normalizeLicenseKey,
} from "@/lib/licenses";
import { sendLicenseEmail } from "@/lib/email";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMITS.licenseResend, "license-resend");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { licenseKey, sessionId, email, secretKey } = await req.json();

    if (secretKey !== process.env.LICENSE_API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let license = null;

    if (licenseKey) {
      license = await getLicenseByKey(normalizeLicenseKey(licenseKey));
    } else if (sessionId) {
      license = await getLicenseBySessionId(sessionId);
    } else if (email) {
      license = await getLatestLicenseByEmail(email);
    } else {
      return NextResponse.json(
        { error: "licenseKey, sessionId, or email is required" },
        { status: 400 },
      );
    }

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 },
      );
    }

    await sendLicenseEmail({ to: license.email, licenseKey: license.key });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("License resend error:", error);
    return NextResponse.json(
      { error: "Failed to resend license email" },
      { status: 500 },
    );
  }
}
