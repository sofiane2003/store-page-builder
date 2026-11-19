// Shared helpers for the release checks.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

/** Pick an option in one of the app's Select components by its test id. */
export async function choose(page, testId, optionName) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await expect(page.getByTestId(testId)).toContainText(optionName);
}

/** A 2x2 PNG, enough to stand in for a product photo. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNgYGD4z8DAwMDEwMDAAAAPBQEBpE4zXQAAAABJRU5ErkJggg==",
  "base64",
);

/** Creates a product through the products page; returns nothing. */
export async function createProduct(page, { name, price, currency = "USD", description, buyUrl, image = true }) {
  await page.goto("/products");
  await page.getByTestId("new-product").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Price").fill(price);
  await dialog.getByLabel("Currency").fill(currency);
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Buy link").fill(buyUrl);
  if (image) {
    await dialog.getByTestId("product-image").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  }
  await dialog.getByRole("button", { name: "Save product" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("product-row").filter({ hasText: name })).toBeVisible();
}

/** Creates a blank page through the pages list and waits for its editor. Returns the page id. */
export async function createBlankPage(page, { title, product, type = "Product page" }) {
  await page.goto("/");
  await page.getByTestId("new-page").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await choose(page, "page-product", product);
  await choose(page, "page-type", type);
  await dialog.getByRole("button", { name: "Create blank page" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url().split("/pages/")[1];
}

/** Records the next server-function request a click sends, so it can be replayed as someone else. */
export async function captureServerCall(page, trigger) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/_serverFn/")),
    trigger(),
  ]);
  return { path: new URL(request.url()).pathname + new URL(request.url()).search, body: request.postData(), headers: request.headers() };
}
