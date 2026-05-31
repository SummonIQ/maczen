import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type LicensePlan = "pro";

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }
  return `MCZN-${segments.join("-")}`;
}

export function normalizeLicenseKey(key: string): string {
  return key.toUpperCase().trim();
}

export async function createLicenseForSession(input: {
  email: string;
  plan?: LicensePlan;
  stripeCustomerId?: string | null;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}) {
  const {
    email,
    plan = "pro",
    stripeCustomerId,
    stripeSessionId,
    stripeSubscriptionId,
    stripePriceId,
  } = input;

  if (!email) {
    throw new Error("Email is required to create a license");
  }

  if (stripeSessionId) {
    const existing = await prisma.license.findUnique({
      where: { stripeSessionId },
    });
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateLicenseKey();
    try {
      return await prisma.license.create({
        data: {
          key,
          email,
          plan,
          stripeCustomerId: stripeCustomerId || undefined,
          stripeSessionId: stripeSessionId || undefined,
          stripeSubscriptionId: stripeSubscriptionId || undefined,
          stripePriceId: stripePriceId || undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate a unique license key");
}

export async function getLicenseByKey(key: string) {
  return prisma.license.findUnique({ where: { key } });
}

export async function getLicenseBySessionId(stripeSessionId: string) {
  return prisma.license.findUnique({ where: { stripeSessionId } });
}

export async function activateLicenseByKey(
  key: string,
  machineId?: string | null,
) {
  const license = await prisma.license.findUnique({ where: { key } });
  if (!license) return null;

  if (license.status !== "active") return license;

  if (!license.activatedAt || (!license.machineId && machineId)) {
    return prisma.license.update({
      where: { key },
      data: {
        activatedAt: license.activatedAt || new Date(),
        machineId: machineId || license.machineId || undefined,
      },
    });
  }

  return license;
}

export async function revokeLicensesForCustomer(stripeCustomerId: string) {
  return prisma.license.updateMany({
    where: { stripeCustomerId },
    data: { status: "revoked" },
  });
}

export async function revokeLicenseForSubscription(
  stripeSubscriptionId: string,
) {
  return prisma.license.updateMany({
    where: { stripeSubscriptionId },
    data: { status: "revoked" },
  });
}

export async function revokeLicenseForSessionId(stripeSessionId: string) {
  return prisma.license.updateMany({
    where: { stripeSessionId },
    data: { status: "revoked" },
  });
}

export async function getLatestLicenseByEmail(email: string) {
  return prisma.license.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
}
