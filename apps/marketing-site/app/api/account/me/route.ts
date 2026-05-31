import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { applyCors, buildOptionsResponse } from "@/lib/cors";
import { getEntitlementsFromSubscription } from "@/lib/entitlements";

export async function OPTIONS(req: NextRequest) {
  return buildOptionsResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return applyCors(
        req,
        NextResponse.json(
          {
            authenticated: false,
            user: null,
            subscription: null,
            entitlements: getEntitlementsFromSubscription(null),
          },
          { status: 401 },
        ),
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id },
    });

    return applyCors(
      req,
      NextResponse.json({
        authenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || null,
          firstName: (session.user as { firstName?: string }).firstName || null,
          lastName: (session.user as { lastName?: string }).lastName || null,
        },
        subscription,
        entitlements: getEntitlementsFromSubscription(
          subscription
            ? { plan: subscription.plan, status: subscription.status }
            : null,
        ),
      }),
    );
  } catch (error) {
    console.error("Account me route error:", error);
    return applyCors(
      req,
      NextResponse.json(
        {
          authenticated: false,
          user: null,
          subscription: null,
          entitlements: getEntitlementsFromSubscription(null),
          error: "Failed to resolve session",
        },
        { status: 500 },
      ),
    );
  }
}

