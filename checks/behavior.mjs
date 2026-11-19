// Behavior: every frozen feature's main path, through the packaged release.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { choose, createProduct, createBlankPage } from "./helpers.mjs";

// A Gateway with the AI provider and Shopify configured: answers model calls
// with fixed sections and Shopify's page mutations with an id.
const FAKE_GATEWAY = `export default { async fetch(request) {
  const url = new URL(request.url);
  const body = request.method === "GET" ? "" : await request.text();
  if (url.pathname === "/api/integrations/shopify") return Response.json({ requested: true, configured: true, ready: true });
  if (url.pathname === "/api/integrations/shopify/northfield-goods.myshopify.com/admin/api/2026-01/graphql.json" && request.method === "POST") {
    const update = body.includes("pageUpdate");
    const page = { id: "gid://shopify/Page/7001", handle: "trailhead-bottle" };
    return Response.json({ data: update ? { pageUpdate: { page, userErrors: [] } } : { pageCreate: { page, userErrors: [] } } });
  }
  if (url.pathname.endsWith("/chat/completions")) {
    const revise = body.includes("You rewrite one section");
    const page = { sections: [
      { kind: "hero", headline: "Ice-cold water from sunrise to summit", subheadline: "Double-wall steel keeps drinks cold for 24 hours.", buttonLabel: "Get yours" },
      { kind: "benefits", heading: "Why hikers switch", items: [{ text: "Cold for a full day" }, { text: "Leak-proof lid" }, { text: "Fits every cup holder" }] },
      { kind: "reviews", heading: "Trail-tested", items: [{ author: "Maya R.", rating: 5, text: "Still icy after an eight-hour climb." }, { author: "Jon P.", rating: 5, text: "No sweat on my pack, ever." }] },
      { kind: "faq", heading: "Questions", items: [{ question: "Is it dishwasher safe?", answer: "The lid is; hand-wash the bottle." }, { question: "How much does it hold?", answer: "750 ml." }] },
      { kind: "cta", heading: "Ready for the trail?", text: "Free returns for 30 days.", buttonLabel: "Buy now" },
      { kind: "stickyBar", buttonLabel: "Add to cart" }
    ] };
    const section = { kind: "faq", heading: "Questions", items: [
      { question: "Is it dishwasher safe?", answer: "The lid is; hand-wash the bottle." },
      { question: "How much does it hold?", answer: "750 ml." },
      { question: "Does it fit a car cup holder?", answer: "Yes, the base is 7 cm wide." },
      { question: "Is there a warranty?", answer: "Lifetime against leaks." } ] };
    const content = JSON.stringify(revise ? { section } : page);
    return Response.json({ id: "x", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] });
  }
  return Response.json({ code: "integration_not_configured" }, { status: 503, headers: { "x-everyapp-error": "integration_not_configured" } });
} };`;

const runtime = await startRuntime({
  workers: [{ config: { name: "fake-gateway", compatibilityDate: "2026-01-01", manifest: { mainModule: "fake.mjs", modules: { "fake.mjs": { type: "esm", contents: FAKE_GATEWAY } } } } }],
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
});
try {
  const owner = await runtime.context("owner");
  const page = await owner.newPage();

  // F004: brand profile.
  await page.goto("/brand");
  await page.getByLabel("Brand name").fill("Northfield Goods");
  await page.getByLabel("Voice notes").fill("Warm, outdoorsy, plain words. Short sentences.");
  await page.getByLabel("Default language").fill("English");
  await page.getByLabel("Shopify store").fill("northfield-goods.myshopify.com");
  await choose(page, "brand-preset", "Bold");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText("Brand saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Brand name")).toHaveValue("Northfield Goods");
  await expect(page.getByTestId("brand-preset")).toContainText("Bold");

  // F001: products, with an image, a sortable and paginated list.
  await createProduct(page, {
    name: "Trailhead Insulated Bottle", price: "34.00", description: "A 750 ml steel bottle that keeps water cold all day.",
    buyUrl: "https://shop.northfield.example/products/trailhead-bottle",
  });
  await createProduct(page, {
    name: "Summit Coffee Press", price: "49.00", description: "A packable press for camp coffee.",
    buyUrl: "https://shop.northfield.example/products/summit-press",
  });
  const bottleRow = page.getByTestId("product-row").filter({ hasText: "Trailhead Insulated Bottle" });
  await expect(bottleRow).toContainText("34.00");
  await expect(bottleRow.locator("img")).toHaveAttribute("src", /^\/f\//);
  await page.getByRole("button", { name: "Sort by Price" }).click();
  await expect(page.getByTestId("product-row").first()).toContainText("Trailhead Insulated Bottle");
  await page.getByRole("button", { name: "Sort by Price" }).click();
  await expect(page.getByTestId("product-row").first()).toContainText("Summit Coffee Press");
  // Edit.
  await bottleRow.getByRole("button", { name: "Edit Trailhead Insulated Bottle" }).click();
  await page.getByRole("dialog").getByLabel("Price").fill("36.00");
  await page.getByRole("dialog").getByRole("button", { name: "Save product" }).click();
  await expect(bottleRow).toContainText("36.00");
  // Pagination: 12 more products straight into the database.
  const db = await runtime.database();
  const { results: [{ owner_id: ownerId }] } = await db.prepare("SELECT owner_id FROM products LIMIT 1").all();
  for (let i = 1; i <= 12; i++) {
    await db.prepare("INSERT INTO products (id, owner_id, name, price_cents, currency, description, buy_url) VALUES (?, ?, ?, ?, 'USD', '', 'https://shop.northfield.example/p')")
      .bind(crypto.randomUUID(), ownerId, `Camp Mug ${String(i).padStart(2, "0")}`, 1000 + i).run();
  }
  await page.reload();
  await expect(page.getByTestId("product-row")).toHaveCount(10);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("product-row")).toHaveCount(4);

  // F003: AI writes a whole page from a description.
  await page.goto("/");
  await page.getByTestId("new-page").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Trailhead bottle launch");
  await choose(page, "page-product", "Trailhead Insulated Bottle");
  await choose(page, "page-type", "Product page");
  await dialog.getByLabel("Angle and audience").fill("Day hikers who hate warm water by noon.");
  await dialog.getByRole("button", { name: "Write with AI" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]{36}$/);
  const pageId = page.url().split("/pages/")[1];
  const cards = page.getByTestId("section-card");
  await expect(cards).toHaveCount(6);
  await expect(page.getByLabel("Headline").first()).toHaveValue("Ice-cold water from sunrise to summit");
  // New pages take the brand's preset and language.
  await expect(page.getByTestId("page-preset")).toContainText("Bold");
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("English");

  // F003: rewrite only the FAQ section.
  const faq = cards.filter({ has: page.locator("[data-kind=faq]") });
  await faq.getByRole("button", { name: "Ask AI" }).click();
  await page.getByLabel("Instruction").fill("add two more questions");
  await page.getByRole("button", { name: "Rewrite section" }).click();
  await expect(faq.getByLabel(/^Question \d$/)).toHaveCount(4);
  await expect(page.getByTestId("ai-message").filter({ hasText: "add two more questions" })).toBeVisible();
  await expect(page.getByLabel("Headline").first()).toHaveValue("Ice-cold water from sunrise to summit");

  // F002: hand edits, add, reorder, delete.
  const hero = cards.filter({ has: page.locator("[data-kind=hero]") });
  await hero.getByLabel("Headline").fill("Cold water, all day long");
  await hero.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByText("Section saved")).toBeVisible();
  await choose(page, "add-section-kind", "Countdown");
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(cards).toHaveCount(7);
  const countdown = cards.last();
  await countdown.getByLabel("Heading").fill("Launch price ends soon");
  await countdown.getByLabel("Ends at").fill("2099-01-01T12:00");
  await countdown.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByText("Section saved")).toBeVisible();
  await countdown.getByRole("button", { name: "Move up" }).click();
  await expect(cards.nth(5)).toHaveAttribute("data-section-kind", "countdown");
  const cta = cards.filter({ has: page.locator("[data-kind=cta]") });
  await cta.getByRole("button", { name: "Delete section" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(cards).toHaveCount(6);
  await page.reload();
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(4)).toHaveAttribute("data-section-kind", "countdown");
  await expect(page.getByLabel("Headline").first()).toHaveValue("Cold water, all day long");

  // F002: settings.
  await page.getByLabel("Slug").fill("trailhead-bottle");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  // F007: save a section to the library, insert a copy, edit the copy.
  const reviews = cards.filter({ has: page.locator("[data-kind=reviews]") });
  await reviews.getByRole("button", { name: "Save to library" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Bottle reviews");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to library")).toBeVisible();
  await choose(page, "library-pick", "Bottle reviews");
  await page.getByRole("button", { name: "Insert" }).click();
  await expect(cards).toHaveCount(7);
  const copy = cards.last();
  await copy.getByLabel("Heading").fill("More happy hikers");
  await copy.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByText("Section saved")).toBeVisible();
  await page.goto("/library");
  const saved = page.getByTestId("saved-row").filter({ hasText: "Bottle reviews" });
  await expect(saved).toBeVisible();
  await expect(saved).toContainText("Trail-tested");
  await expect(saved).not.toContainText("More happy hikers");

  // F005: publish and open the public link without signing in.
  await page.goto(`/pages/${pageId}`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Published");
  await expect(page.getByTestId("public-link")).toHaveAttribute("href", new RegExp(`^https?://${runtime.hostname.replaceAll(".", "\\.")}/s/trailhead-bottle$`));
  const pub = await runtime.fetch("/s/trailhead-bottle");
  expect(pub.status).toBe(200);
  const html = await pub.text();
  expect(html).toContain("Cold water, all day long");
  expect(html).toContain("https://shop.northfield.example/products/trailhead-bottle");
  expect(html).toContain("$36.00");
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto("/s/trailhead-bottle");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Cold water, all day long");
  await expect(visitor.getByTestId("buy-button").first()).toHaveAttribute("href", "https://shop.northfield.example/products/trailhead-bottle");
  await expect(visitor.getByTestId("sticky-bar")).toBeVisible();
  await expect(visitor.getByTestId("countdown")).toBeVisible();
  await expect(visitor.getByText("Is there a warranty?")).toBeVisible();
  const img = await visitor.locator("img").first().getAttribute("src");
  expect((await runtime.fetch(img)).status).toBe(200);

  // F005: Shopify push, then update.
  await page.getByRole("button", { name: "Push to Shopify" }).click();
  await expect(page.getByTestId("shopify-status")).toContainText("On Shopify");
  await page.getByRole("button", { name: "Update on Shopify" }).click();
  await expect(page.getByText("Updated on Shopify")).toBeVisible();

  // F005: an ended countdown disappears; unpublishing or deleting takes the link down.
  const second = await createBlankPage(page, { title: "Coffee press listicle", product: "Summit Coffee Press", type: "Listicle" });
  await choose(page, "add-section-kind", "Countdown");
  await page.getByRole("button", { name: "Add section" }).click();
  await cards.last().getByLabel("Heading").fill("Sale ended");
  await cards.last().getByLabel("Ends at").fill("2020-01-01T12:00");
  await cards.last().getByRole("button", { name: "Save section" }).click();
  await expect(page.getByText("Section saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Published");
  const slug2 = (await page.getByTestId("public-link").getAttribute("href")).split("/s/")[1];
  await visitor.goto(`/s/${slug2}`);
  await expect(visitor.getByTestId("public-page")).toBeVisible();
  await expect(visitor.getByTestId("countdown")).toHaveCount(0);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Draft");
  expect((await runtime.fetch(`/s/${slug2}`)).status).toBe(404);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("page-status")).toHaveText("Published");
  await page.getByRole("button", { name: "Delete page" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect((await runtime.fetch(`/s/${slug2}`)).status).toBe(404);
  expect(second).toBeTruthy();

  // F002: the pages list.
  const row = page.getByTestId("page-row").filter({ hasText: "Trailhead bottle launch" });
  await expect(row).toContainText("Product page");
  await expect(row).toContainText("Trailhead Insulated Bottle");
  await expect(row).toContainText("Published");

  // F001: a product a page uses can't be deleted.
  await page.goto("/products");
  await page.getByRole("button", { name: "Sort by Price" }).click();
  await page.getByRole("button", { name: "Sort by Price" }).click();
  const used = page.getByTestId("product-row").filter({ hasText: "Trailhead Insulated Bottle" });
  await used.getByRole("button", { name: "Delete Trailhead Insulated Bottle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("form-error")).toContainText("in use");
  await page.keyboard.press("Escape");
  await expect(used).toBeVisible();
  const mug = page.getByTestId("product-row").filter({ hasText: "Camp Mug 12" });
  await mug.getByRole("button", { name: "Delete Camp Mug 12" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(mug).toHaveCount(0);

  // F006: a quiz that recommends a product.
  await page.goto("/quizzes");
  await page.getByTestId("new-quiz").click();
  await page.getByRole("dialog").getByLabel("Title").fill("Which trail kit fits you?");
  await page.getByRole("dialog").getByRole("button", { name: "Create quiz" }).click();
  await page.waitForURL(/\/quizzes\/[0-9a-f-]{36}$/);
  await page.getByLabel("Intro").fill("Two quick questions and we'll point you to the right gear.");
  await page.getByLabel("Slug").fill("trail-kit");
  for (const [q, answers] of [
    ["What do you crave at the trailhead?", [["Cold water", "Trailhead Insulated Bottle"], ["Hot coffee", "Summit Coffee Press"]]],
    ["How long are your outings?", [["A few hours", "Trailhead Insulated Bottle"], ["Overnight", "Summit Coffee Press"]]],
  ]) {
    await page.getByRole("button", { name: "Add question" }).click();
    const block = page.getByTestId("quiz-question").last();
    await block.getByLabel("Question").fill(q);
    for (const [text, product] of answers) {
      await block.getByRole("button", { name: "Add answer" }).click();
      const answer = block.getByTestId("quiz-answer").last();
      await answer.getByLabel("Answer").fill(text);
      await answer.getByTestId("answer-product").click();
      await page.getByRole("option", { name: product, exact: true }).click();
      await answer.getByLabel("Points").fill("2");
    }
  }
  await page.getByRole("button", { name: "Save quiz" }).click();
  await expect(page.getByText("Quiz saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("quiz-status")).toHaveText("Published");
  await visitor.goto("/q/trail-kit");
  await expect(visitor.getByText("Two quick questions and we'll point you to the right gear.")).toBeVisible();
  await visitor.getByRole("button", { name: "Start" }).click();
  await expect(visitor.getByText("What do you crave at the trailhead?")).toBeVisible();
  await visitor.getByRole("button", { name: "Hot coffee" }).click();
  await expect(visitor.getByText("How long are your outings?")).toBeVisible();
  await visitor.getByRole("button", { name: "Overnight" }).click();
  const result = visitor.getByTestId("quiz-result");
  await expect(result).toContainText("Summit Coffee Press");
  await expect(result).toContainText("$49.00");
  await expect(result.getByRole("link", { name: /buy/i })).toHaveAttribute("href", "https://shop.northfield.example/products/summit-press");
  // Request level: the server scores the answers.
  const quizHtml = await (await runtime.fetch("/q/trail-kit")).text();
  expect(quizHtml).not.toContain("points");
  const scored = await runtime.fetch("/q/trail-kit/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [0, 0] }) });
  expect(scored.status).toBe(200);
  const scoredBody = await scored.json();
  expect(scoredBody.product.name).toBe("Trailhead Insulated Bottle");
  expect(scoredBody.product.buyUrl).toBe("https://shop.northfield.example/products/trailhead-bottle");
  const bad = await runtime.fetch("/q/trail-kit/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: [9] }) });
  expect(bad.status).toBe(400);
  await page.reload();
  const results = page.getByTestId("quiz-results");
  await expect(results.getByTestId("result-row").filter({ hasText: "Summit Coffee Press" })).toContainText("1");
  await expect(results.getByTestId("result-row").filter({ hasText: "Trailhead Insulated Bottle" })).toContainText("1");

  // Phone-sized smoke.
  const phone = await (await runtime.context(null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/s/trailhead-bottle");
  await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(phone.getByTestId("sticky-bar")).toBeInViewport();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const memberPhone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await memberPhone.goto("/");
  await expect(memberPhone.getByRole("heading", { level: 1, name: "Pages" })).toBeVisible();

  // The journey's result: the published page in the editor's preview.
  await page.goto(`/pages/${pageId}`);
  await runtime.assertBackLink(page);
  await page.getByRole("tab", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Phone" }).click();
  await expect(page.getByTestId("page-preview")).toHaveAttribute("data-width", "phone");
  await page.getByRole("button", { name: "Desktop" }).click();
  await expect(page.getByTestId("page-preview")).toHaveAttribute("data-width", "desktop");
  await expect(page.getByTestId("page-preview").getByRole("heading", { name: "Cold water, all day long" })).toBeVisible();
  await runtime.screenshot(page);
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
