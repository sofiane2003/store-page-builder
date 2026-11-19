// Persistence: what members write survives a restart. Also the states a
// person meets with no AI provider or Shopify connection configured.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { choose, createProduct, createBlankPage } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/brand");
  await page.getByLabel("Brand name").fill("Harbor Tea Co.");
  await choose(page, "brand-preset", "Soft");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Brand saved")).toBeVisible();
  await createProduct(page, { name: "Harbor Breakfast Blend", price: "12.50", currency: "EUR", description: "Loose-leaf black tea.", buyUrl: "https://harbor.example/breakfast" });

  // With no AI provider, writing with AI says so and creates nothing.
  await page.goto("/");
  await page.getByTestId("new-page").click();
  await page.getByRole("dialog").getByLabel("Title").fill("Tea landing");
  await choose(page, "page-product", "Harbor Breakfast Blend");
  await choose(page, "page-type", "Landing page");
  await page.getByRole("dialog").getByLabel("Angle and audience").fill("Morning people.");
  await page.getByRole("dialog").getByRole("button", { name: "Write with AI" }).click();
  await expect(page.getByTestId("ai-off")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("page-row")).toHaveCount(0);

  // Hand editing still works.
  const id = await createBlankPage(page, { title: "Tea landing", product: "Harbor Breakfast Blend", type: "Landing page" });
  await expect(page.getByTestId("page-preset")).toContainText("Soft");
  await choose(page, "add-section-kind", "Hero");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByTestId("section-card").last().getByLabel("Headline").fill("A calmer first cup");
  await page.getByTestId("section-card").last().getByRole("button", { name: "Save section" }).click();
  await expect(page.getByText("Section saved")).toBeVisible();
  await page.getByTestId("section-card").last().getByRole("button", { name: "Ask AI" }).click();
  await page.getByLabel("Instruction").fill("make it shorter");
  await page.getByRole("button", { name: "Rewrite section" }).click();
  await expect(page.getByTestId("ai-off")).toBeVisible();
  await expect(page.getByTestId("section-card").last().getByLabel("Headline")).toHaveValue("A calmer first cup");
  // Shopify isn't connected: the push is unavailable.
  await expect(page.getByTestId("shopify-off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Push to Shopify" })).toHaveCount(0);
  await page.getByLabel("Slug").fill("calmer-cup");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Published");

  await runtime.restart();

  const after = await (await runtime.context("owner")).newPage();
  await after.goto("/products");
  await expect(after.getByTestId("product-row").filter({ hasText: "Harbor Breakfast Blend" })).toContainText("12.50");
  await after.goto(`/pages/${id}`);
  await expect(after.getByTestId("section-card").last().getByLabel("Headline")).toHaveValue("A calmer first cup");
  await expect(after.getByTestId("page-status")).toHaveText("Published");
  await after.goto("/brand");
  await expect(after.getByLabel("Brand name")).toHaveValue("Harbor Tea Co.");
  const pub = await runtime.fetch("/s/calmer-cup");
  expect(pub.status).toBe(200);
  expect(await pub.text()).toContain("A calmer first cup");
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
