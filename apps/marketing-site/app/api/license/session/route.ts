import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getLicenseBySessionId } from "@/lib/licenses";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 403 },
      );
    }

    const license = await getLicenseBySessionId(sessionId);
    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      licenseKey: license.key,
      email: license.email,
      plan: license.plan,
      stripeCustomerId: license.stripeCustomerId ?? null,
      amountTotal:
        typeof session.amount_total === "number" ? session.amount_total / 100 : null,
      currency: session.currency || null,
    });
  } catch (error) {
    console.error("License session lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup license" },
      { status: 500 },
    );
  }
}
