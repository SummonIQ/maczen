import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls = [];
    (window as Window & { fbq: (...args: unknown[]) => void }).fbq = (...args) => {
      (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls.push(args);
    };
  });
});

test("subscribe page fires ViewContent and InitiateCheckout", async ({
  page,
}) => {
  await page.route("**/api/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ error: "mock checkout response" }),
    });
  });

  await page.goto("http://127.0.0.1:30051/subscribe?plan=PRO_YEARLY", {
    waitUntil: "networkidle",
  });

  await expect(page.getByRole("heading", { name: /choose your pro plan/i })).toBeVisible();

  const viewContentCalls = await page.evaluate(() => {
    return (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls.filter(
      (call) => call[0] === "track" && call[1] === "ViewContent",
    );
  });
  expect(viewContentCalls.length).toBeGreaterThan(0);

  await page.getByPlaceholder("you@example.com").fill("test@maczen.app");
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await expect(page.getByText("mock checkout response")).toBeVisible();

  const initiateCheckoutCalls = await page.evaluate(() => {
    return (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls.filter(
      (call) => call[0] === "track" && call[1] === "InitiateCheckout",
    );
  });
  expect(initiateCheckoutCalls.length).toBe(1);
});

test("success page fires Purchase with the session id as eventID", async ({
  page,
}) => {
  await page.route("**/api/license/session?session_id=cs_test_123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "cs_test_123",
        licenseKey: "LICENSE-123",
        amountTotal: 79,
        currency: "usd",
      }),
    });
  });

  await page.goto("http://127.0.0.1:30051/success?session_id=cs_test_123", {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("LICENSE-123")).toBeVisible();

  const purchaseCalls = await page.evaluate(() => {
    return (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls.filter(
      (call) => call[0] === "track" && call[1] === "Purchase",
    );
  });

  expect(purchaseCalls.length).toBe(1);
  expect(purchaseCalls[0][3]).toEqual({ eventID: "cs_test_123" });
});

test("download CTA fires the Meta custom download event", async ({ page }) => {
  await page.goto("http://127.0.0.1:30051/", {
    waitUntil: "networkidle",
  });

  await expect(
    page.getByRole("link", { name: /download for mac/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /download for mac/i }).click();

  const downloadCalls = await page.evaluate(() => {
    return (window as Window & { __fbqCalls: unknown[][] }).__fbqCalls.filter(
      (call) => call[0] === "trackCustom" && call[1] === "DownloadApp",
    );
  });

  expect(downloadCalls.length).toBe(1);
});
