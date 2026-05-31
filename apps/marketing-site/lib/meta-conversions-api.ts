import crypto from "node:crypto";

type MetaPurchasePayload = {
  email?: string | null;
  externalId?: string | null;
  eventId: string;
  eventSourceUrl?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  value?: number | null;
  currency?: string | null;
};

const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
const datasetId =
  process.env.META_DATASET_ID?.trim() || process.env.META_PIXEL_ID?.trim();
const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
const testEventCode = process.env.META_CONVERSIONS_API_TEST_EVENT_CODE?.trim();

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildUserData(payload: MetaPurchasePayload) {
  const userData: Record<string, string | string[]> = {};

  if (payload.email) {
    userData.em = [sha256(normalizeEmail(payload.email))];
  }

  if (payload.externalId) {
    userData.external_id = [sha256(payload.externalId.trim())];
  }

  if (payload.clientIpAddress) {
    userData.client_ip_address = payload.clientIpAddress;
  }

  if (payload.clientUserAgent) {
    userData.client_user_agent = payload.clientUserAgent;
  }

  if (payload.fbp) {
    userData.fbp = payload.fbp;
  }

  if (payload.fbc) {
    userData.fbc = payload.fbc;
  }

  return userData;
}

export function metaConversionsApiConfigured() {
  return Boolean(accessToken && datasetId);
}

export async function sendMetaPurchaseEvent(payload: MetaPurchasePayload) {
  if (!metaConversionsApiConfigured()) {
    return { skipped: true as const, reason: "missing_config" as const };
  }

  const userData = buildUserData(payload);

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: payload.eventId,
        action_source: "website",
        event_source_url: payload.eventSourceUrl || undefined,
        user_data: userData,
        custom_data: {
          currency: (payload.currency || "USD").toUpperCase(),
          value: payload.value ?? undefined,
        },
      },
    ],
    access_token: accessToken,
  };

  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${datasetId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Meta CAPI error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return {
    skipped: false as const,
    status: response.status,
    body: text,
  };
}
