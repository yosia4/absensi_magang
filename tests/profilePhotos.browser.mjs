import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.clock.install();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/test-photo/**", (route) => route.fulfill({
    status: route.request().url().includes("broken") ? 404 : 200,
    contentType: "image/svg+xml",
    body: route.request().url().includes("broken") ? "Image unavailable" : '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="green"/></svg>',
  }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/profilePhotos.html`);
  const waitForImage = () => page.waitForFunction(() => document.querySelector("img")?.naturalWidth > 0);
  await waitForImage();
  const first = await page.locator("img").getAttribute("src");
  await page.clock.fastForward(50 * 60 * 1000);
  await page.waitForFunction((old) => document.querySelector("img")?.getAttribute("src") !== old, first);
  await waitForImage();
  assert.equal(await page.evaluate(() => window.photoCalls.length), 2);
  await page.evaluate(() => window.changePhoto("retry"));
  await waitForImage();
  await page.waitForFunction(() => window.photoCalls.filter((p) => p === "retry").length === 2);
  await waitForImage();
  await page.evaluate(() => window.changePhoto("broken"));
  await page.waitForFunction(() => window.photoCalls.filter((p) => p === "broken").length === 2 && !document.querySelector("img"));
  assert.equal(await page.getByRole("img").textContent(), "AP");
  await page.evaluate(() => window.changePhoto("replaced"));
  await waitForImage();
  const invalidMessage = await page.evaluate(async () => {
    try { await window.validatePhoto(new File(["not an image"], "photo.jpg", { type: "image/jpeg" })); }
    catch (error) { return error.message; }
  });
  assert.match(invalidMessage, /tidak dapat dibaca/);
  assert.deepEqual(errors, []);
  console.log("PASS: expiry renewal, bounded image retry, initials fallback, photo replacement, corrupt upload rejection");
} finally {
  await browser?.close();
  await server.close();
}
