import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { applyCors, buildOptionsResponse } from "@/lib/cors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function OPTIONS(req: NextRequest) {
  return buildOptionsResponse(req);
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResponse = checkRateLimit(req, RATE_LIMITS.billingPortal, "billing-portal");
  if (rateLimitResponse) return applyCors(req, rateLimitResponse);

  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return applyCors(
        req,
        NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        ),
      );
    }

    // Find the user's subscription to get the Stripe customer ID
    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      return applyCors(
        req,
        NextResponse.json(
          { error: "No billing information found" },
          { status: 404 },
        ),
      );
    }

    const returnUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:30051";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${returnUrl}/settings`,
    });

    return applyCors(
      req,
      NextResponse.json({ url: portalSession.url }),
    );
  } catch (error) {
    console.error("Billing portal error:", error);
    return applyCors(
      req,
      NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500 },
      ),
    );
  }
}
