import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_DESKTOP_APP_URL,
      "http://localhost:30051",
      "http://localhost:30232",
      "http://localhost:30141",
      "http://localhost:30143",
      "http://localhost:5173",
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

export const auth = betterAuth({
  appName: "MacZen",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    autoSignIn: true,
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
    },
    cookie: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    expiresIn: 7 * 24 * 60 * 60,
    freshAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  trustedOrigins,
  user: {
    modelName: "user",
    additionalFields: {
      firstName: {
        required: false,
        type: "string",
      },
      lastName: {
        required: false,
        type: "string",
      },
    },
  },
});
