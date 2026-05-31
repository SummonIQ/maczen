import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:30051",
});

export const { signIn, signUp, signOut, useSession } = authClient;

