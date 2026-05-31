import { NextRequest, NextResponse } from "next/server";
import {
  isValidStripePlanType,
  stripe,
  STRIPE_PLANS,
  type StripePlanType,
} from "@/lib/stripe";
import { auth } from "@/lib/auth/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMITS.checkout, "checkout");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email, planType, fbp, fbc, eventSourceUrl } = await req.json();
    const authSession = await auth.api.getSession({
      headers: req.headers,
    });
    const sessionEmail = authSession?.user?.email || null;
    const checkoutEmail = sessionEmail || email;

    if (!checkoutEmail || !planType) {
      return NextResponse.json(
        { error: "Email and plan type are required" },
        { status: 400 }
      );
    }

    const clientIpAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";
    const clientUserAgent = (req.headers.get("user-agent") || "").slice(0, 500);

    // Create or get Stripe customer
    const customers = await stripe.customers.list({ email: checkoutEmail, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({ email: checkoutEmail });
      customerId = customer.id;
    }

    if (!isValidStripePlanType(planType)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    // Determine price ID based on plan type
    const priceId = STRIPE_PLANS[planType as StripePlanType];

    if (!priceId) {
      return NextResponse.json(
        { error: "Requested plan is not currently available" },
        { status: 400 },
      );
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: planType === "LIFETIME" ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:30051"
      }/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:30051"
      }/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        planType,
        ...(authSession?.user?.id ? { userId: authSession.user.id } : {}),
        ...(checkoutEmail ? { email: checkoutEmail } : {}),
        ...(typeof fbp === "string" && fbp ? { fbp } : {}),
        ...(typeof fbc === "string" && fbc ? { fbc } : {}),
        ...(typeof eventSourceUrl === "string" && eventSourceUrl
          ? { eventSourceUrl: eventSourceUrl.slice(0, 500) }
          : {}),
        ...(clientIpAddress ? { clientIpAddress } : {}),
        ...(clientUserAgent ? { clientUserAgent } : {}),
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
