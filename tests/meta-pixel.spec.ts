import { test, expect } from "@playwright/test";

test("homepage includes Meta Pixel bootstrap and noscript fallback", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:30051/", { waitUntil: "networkidle" });

  await expect(page.locator("header")).toBeVisible();
  await page.locator("header").getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const script = Array.from(document.head.querySelectorAll("script")).find(
          (node) => node.textContent?.includes("2333631093846452"),
        );
        return {
          fbqType: typeof (window as Window & { fbq?: unknown }).fbq,
          inHead: Boolean(script),
        };
      });
    })
    .toEqual({ fbqType: "function", inHead: true });

  const inlineScriptContent = await page.evaluate(() => {
    const script = Array.from(document.head.querySelectorAll("script")).find(
      (node) => node.textContent?.includes("2333631093846452"),
    );
    return script?.textContent ?? null;
  });
  expect(inlineScriptContent).toContain("fbq('init', '2333631093846452')");
  expect(inlineScriptContent).toContain("fbq('track', 'PageView')");

  const html = await page.content();
  expect(html).toContain(
    "https://www.facebook.com/tr?id=2333631093846452&amp;ev=PageView&amp;noscript=1",
  );
});
