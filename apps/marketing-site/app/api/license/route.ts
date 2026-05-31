import { NextRequest, NextResponse } from "next/server";
import {
  activateLicenseByKey,
  createLicenseForSession,
  getLicenseByKey,
  normalizeLicenseKey,
} from "@/lib/licenses";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// POST: Create a new license (called after successful payment)
// GET: Validate a license key
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMITS.general, "license-create");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email, stripeCustomerId, stripeSessionId, secretKey } =
      await req.json();

    // Simple secret key check for internal API calls
    if (secretKey !== process.env.LICENSE_API_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const license = await createLicenseForSession({
      email,
      plan: "pro",
      stripeCustomerId,
      stripeSessionId,
    });

    return NextResponse.json({
      success: true,
      licenseKey: license.key,
      email,
    });
  } catch (error) {
    console.error("License creation error:", error);
    return NextResponse.json(
      { error: "Failed to create license" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMITS.licenseValidation, "license-validate");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(req.url);
    const licenseKey = searchParams.get("key");
    const machineId = searchParams.get("machineId");

    if (!licenseKey) {
      return NextResponse.json(
        { error: "License key is required" },
        { status: 400 }
      );
    }

    const normalizedKey = normalizeLicenseKey(licenseKey);
    const license = await getLicenseByKey(normalizedKey);

    if (!license) {
      return NextResponse.json(
        { valid: false, error: "Invalid license key" },
        { status: 404 }
      );
    }

    if (license.status !== "active") {
      return NextResponse.json(
        { valid: false, error: "License is not active" },
        { status: 403 }
      );
    }

    const activated = await activateLicenseByKey(normalizedKey, machineId);
    if (!activated) {
      return NextResponse.json(
        { valid: false, error: "Invalid license key" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      plan: activated.plan,
      email: activated.email,
      activatedAt: activated.activatedAt,
    });
  } catch (error) {
    console.error("License validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate license" },
      { status: 500 }
    );
  }
}
