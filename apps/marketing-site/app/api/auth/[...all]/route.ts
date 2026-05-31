import { auth } from "@/lib/auth/server";
import { applyCors, buildOptionsResponse } from "@/lib/cors";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

const handlers = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  return applyCors(req, await handlers.GET(req));
}

export async function POST(req: NextRequest) {
  return applyCors(req, await handlers.POST(req));
}

export async function OPTIONS(req: NextRequest) {
  return buildOptionsResponse(req);
}
