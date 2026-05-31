import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  createLicenseForSession,
  revokeLicenseForSessionId,
  revokeLicenseForSubscription,
  revokeLicensesForCustomer,
} from "@/lib/licenses";
import { sendLicenseEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  mapStripePriceIdToPlan,
  mapStripeStatusToSubscriptionStatus,
  upsertSubscriptionForUser,
} from "@/lib/subscriptions";
import { sendMetaPurchaseEvent } from "@/lib/meta-conversions-api";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          // Generate license key for the customer
          const customerEmail =
            session.customer_details?.email || session.customer_email;

          if (customerEmail) {
            const stripeCustomerId =
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id;
            const stripeSubscriptionId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;

            const license = await createLicenseForSession({
              email: customerEmail,
              plan: "pro",
              stripeCustomerId: stripeCustomerId || undefined,
              stripeSessionId: session.id,
              stripeSubscriptionId: stripeSubscriptionId || undefined,
            });

            console.log(
              `License created for ${customerEmail}: ${license.key}`,
            );

            try {
              await sendLicenseEmail({
                to: customerEmail,
                licenseKey: license.key,
              });
            } catch (emailError) {
              console.error("License email failed:", emailError);
            }
          }
        }

        const metadataUserId = session.metadata?.userId?.trim();
        const metadataEmail = session.metadata?.email?.trim();
        const resolvedEmail =
          metadataEmail ||
          session.customer_details?.email ||
          session.customer_email ||
          null;
        let resolvedUserId: string | null = metadataUserId || null;

        if (!resolvedUserId && resolvedEmail) {
          const existingUser = await prisma.user.findUnique({
            where: { email: resolvedEmail },
            select: { id: true },
          });
          resolvedUserId = existingUser?.id || null;
        }

        if (resolvedUserId) {
          const planFromMeta = (session.metadata?.planType || "").toUpperCase();
          const stripeCustomerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;
          const stripeSubscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;

          if (session.mode === "payment" && planFromMeta === "LIFETIME") {
            await upsertSubscriptionForUser({
              userId: resolvedUserId,
              plan: "lifetime",
              status: "active",
              stripeCustomerId,
              stripeSessionId: session.id,
            });
          } else if (stripeSubscriptionId) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(
                stripeSubscriptionId,
              );
              const item = stripeSub.items.data[0];
              await upsertSubscriptionForUser({
                userId: resolvedUserId,
                plan: mapStripePriceIdToPlan(item?.price?.id || null),
                status: mapStripeStatusToSubscriptionStatus(stripeSub.status),
                stripeCustomerId:
                  typeof stripeSub.customer === "string"
                    ? stripeSub.customer
                    : stripeSub.customer?.id,
                stripeSubscriptionId: stripeSub.id,
                stripePriceId: item?.price?.id || null,
                stripeSessionId: session.id,
                currentPeriodStart: stripeSub.current_period_start
                  ? new Date(stripeSub.current_period_start * 1000)
                  : null,
                currentPeriodEnd: stripeSub.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
                canceledAt: stripeSub.canceled_at
                  ? new Date(stripeSub.canceled_at * 1000)
                  : null,
              });
            } catch (subError) {
              console.error("Subscription sync failed:", subError);
            }
          }
        }

        if (session.payment_status === "paid") {
          try {
            const amountTotal =
              typeof session.amount_total === "number"
                ? session.amount_total / 100
                : null;

            await sendMetaPurchaseEvent({
              email: resolvedEmail,
              externalId: resolvedUserId,
              eventId: session.id,
              eventSourceUrl: session.metadata?.eventSourceUrl || null,
              clientIpAddress: session.metadata?.clientIpAddress || null,
              clientUserAgent: session.metadata?.clientUserAgent || null,
              fbp: session.metadata?.fbp || null,
              fbc: session.metadata?.fbc || null,
              value: amountTotal,
              currency: session.currency || "usd",
            });
          } catch (metaError) {
            console.error("Meta purchase event failed:", metaError);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        if (subscriptionId) {
          await revokeLicenseForSubscription(subscriptionId);
        } else if (customerId) {
          await revokeLicensesForCustomer(customerId);
        }

        if (subscription.id) {
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
            select: { userId: true },
          });
          if (dbSubscription?.userId) {
            await upsertSubscriptionForUser({
              userId: dbSubscription.userId,
              plan: mapStripePriceIdToPlan(
                subscription.items.data[0]?.price?.id || null,
              ),
              status: "canceled",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price?.id || null,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : new Date(),
            });
          }
        }

        console.log("Subscription cancelled:", subscriptionId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        // Revoke licenses if subscription becomes past_due, unpaid, or incomplete
        const revokeStatuses = ["past_due", "unpaid", "incomplete", "incomplete_expired"];
        if (revokeStatuses.includes(subscription.status)) {
          if (subscription.id) {
            await revokeLicenseForSubscription(subscription.id);
          } else if (customerId) {
            await revokeLicensesForCustomer(customerId);
          }
          console.log(`License revoked due to subscription status: ${subscription.status}`);
        }

        if (subscription.id) {
          const dbSubscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
            select: { userId: true },
          });
          if (dbSubscription?.userId) {
            await upsertSubscriptionForUser({
              userId: dbSubscription.userId,
              plan: mapStripePriceIdToPlan(
                subscription.items.data[0]?.price?.id || null,
              ),
              status: mapStripeStatusToSubscriptionStatus(subscription.status),
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price?.id || null,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              canceledAt: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
            });
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.id) {
          await revokeLicenseForSessionId(session.id);
        }
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (customerId) {
          await revokeLicensesForCustomer(customerId);
        }
        console.log("Async payment failed:", session.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const customerId =
          typeof charge.customer === "string"
            ? charge.customer
            : charge.customer?.id;
        if (customerId) {
          await revokeLicensesForCustomer(customerId);
        }
        console.log("Charge refunded:", charge.id);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        try {
          if (dispute.charge) {
            const chargeId =
              typeof dispute.charge === "string"
                ? dispute.charge
                : dispute.charge?.id;
            if (chargeId) {
              const charge = await stripe.charges.retrieve(chargeId);
              const customerId =
                typeof charge.customer === "string"
                  ? charge.customer
                  : charge.customer?.id;
              if (customerId) {
                await revokeLicensesForCustomer(customerId);
              }
            }
          }
        } catch (error) {
          console.error("Dispute handling error:", error);
        }
        console.log("Charge disputed:", dispute.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
