type MetaStandardEvent =
  | "ViewContent"
  | "InitiateCheckout"
  | "Purchase"
  | "Lead";

type MetaEventParams = Record<string, string | number | string[] | undefined>;

type MetaEventOptions = {
  eventID?: string;
};

declare global {
  interface Window {
    fbq?: {
      (
        command: "track",
        eventName: MetaStandardEvent,
        params?: MetaEventParams,
        options?: MetaEventOptions,
      ): void;
      (
        command: "trackCustom",
        eventName: string,
        params?: MetaEventParams,
      ): void;
    };
  }
}

export function trackMetaEvent(
  eventName: MetaStandardEvent,
  params?: MetaEventParams,
  options?: MetaEventOptions,
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  if (options?.eventID) {
    window.fbq("track", eventName, params, options);
    return;
  }

  window.fbq("track", eventName, params);
}

export function trackMetaCustomEvent(
  eventName: string,
  params?: MetaEventParams,
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("trackCustom", eventName, params);
}
