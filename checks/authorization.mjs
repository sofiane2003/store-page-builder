// Authorization: private paths, public routes, ownership, admin-only actions,
// and no sign-in of the app's own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { choose, createProduct, createBlankPage, captureServerCall } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/products", "/quizzes", "/library", "/brand"]);

  // No sign-in page of the app's own.
  for (const path of ["/login", "/signin", "/signup", "/logout"]) {
    const anon = await runtime.fetch(path);
    expect(anon.status).not.toBe(200);
    const member = await runtime.fetch(path, { role: "member" });
    expect(member.status).toBe(404);
    expect((await member.text()).toLowerCase()).not.toContain("password");
  }

  // The owner's draft and published objects.
  const ownerPage = await (await runtime.context("owner")).newPage();
  await createProduct(ownerPage, { name: "Ridge Wool Socks", price: "18.00", description: "Merino socks.", buyUrl: "https://ridge.example/socks" });
  await createProduct(ownerPage, { name: "Ridge Rain Shell", price: "120.00", description: "A light shell.", buyUrl: "https://ridge.example/shell" });
  const draftId = await createBlankPage(ownerPage, { title: "Socks draft", product: "Ridge Wool Socks" });
  await ownerPage.getByLabel("Slug").fill("socks-draft");
  await ownerPage.getByRole("button", { name: "Save settings" }).click();
  await expect(ownerPage.getByText("Settings saved")).toBeVisible();
  const publishedId = await createBlankPage(ownerPage, { title: "Shell launch", product: "Ridge Rain Shell" });
  await choose(ownerPage, "add-section-kind", "Hero");
  await ownerPage.getByRole("button", { name: "Add section" }).click();
  await ownerPage.getByTestId("section-card").last().getByLabel("Headline").fill("Stay dry on the ridge");
  await ownerPage.getByTestId("section-card").last().getByRole("button", { name: "Save section" }).click();
  await expect(ownerPage.getByText("Section saved")).toBeVisible();
  await ownerPage.getByLabel("Slug").fill("shell-launch");
  await ownerPage.getByRole("button", { name: "Save settings" }).click();
  await expect(ownerPage.getByText("Settings saved")).toBeVisible();
  await ownerPage.getByRole("button", { name: "Publish" }).click();
  await expect(ownerPage.getByTestId("page-status")).toHaveText("Published");
  await ownerPage.goto("/quizzes");
  await ownerPage.getByTestId("new-quiz").click();
  await ownerPage.getByRole("dialog").getByLabel("Title").fill("Owner quiz");
  await ownerPage.getByRole("dialog").getByRole("button", { name: "Create quiz" }).click();
  await ownerPage.waitForURL(/\/quizzes\/[0-9a-f-]{36}$/);
  const quizId = ownerPage.url().split("/quizzes/")[1];
  const db = await runtime.database();
  const socks = await db.prepare("SELECT id, image_key FROM products WHERE name = 'Ridge Wool Socks'").first();
  const shell = await db.prepare("SELECT id, image_key FROM products WHERE name = 'Ridge Rain Shell'").first();

  // Public routes: only published content, nothing private.
  expect((await runtime.fetch("/s/socks-draft")).status).toBe(404);
  expect((await runtime.fetch("/s/no-such-page")).status).toBe(404);
  const pub = await runtime.fetch("/s/shell-launch");
  expect(pub.status).toBe(200);
  const pubHtml = await pub.text();
  expect(pubHtml).toContain("Stay dry on the ridge");
  expect(pubHtml).not.toContain("Socks draft");
  expect(pubHtml).not.toContain(publishedId);
  expect(pubHtml).not.toMatch(/owner_id|ownerId|@[a-z0-9-]+\.(test|example)/i);
  expect((await runtime.fetch(`/f/${shell.image_key}`)).status).toBe(200);
  expect((await runtime.fetch(`/f/${socks.image_key}`)).status).toBe(404);
  expect((await runtime.fetch("/q/owner-quiz")).status).toBe(404);
  expect((await runtime.fetch("/q/owner-quiz/submit", { method: "POST", headers: { "content-type": "application/json" }, body: "{\"answers\":[]}" })).status).toBe(404);
  // Public routes only take what they list: no writes to share pages.
  expect([401, 403, 404, 405]).toContain((await runtime.fetch("/s/shell-launch", { method: "POST", body: "x" })).status);

  // One member can't read another's objects.
  const memberPage = await (await runtime.context("member")).newPage();
  for (const path of [`/pages/${draftId}`, `/pages/${publishedId}`, `/quizzes/${quizId}`]) {
    await memberPage.goto(path);
    await expect(memberPage.getByTestId("not-found")).toBeVisible();
  }
  await memberPage.goto("/");
  await expect(memberPage.getByTestId("page-row")).toHaveCount(0);
  await memberPage.goto("/products");
  await expect(memberPage.getByText("Ridge Wool Socks")).toHaveCount(0);
  await memberPage.goto("/quizzes");
  await expect(memberPage.getByText("Owner quiz")).toHaveCount(0);
  expect((await runtime.fetch(`/f/${socks.image_key}`, { role: "member" })).status).toBe(404);

  // ...nor change them: the member's own calls, replayed with the owner's ids.
  await createProduct(memberPage, { name: "Member Lantern", price: "25.00", description: "A lantern.", buyUrl: "https://member.example/lantern", image: false });
  const lantern = await db.prepare("SELECT id FROM products WHERE name = 'Member Lantern'").first();
  const memberPageId = await createBlankPage(memberPage, { title: "Lantern page", product: "Member Lantern" });
  const publish = await captureServerCall(memberPage, () => memberPage.getByRole("button", { name: "Publish" }).click());
  await expect(memberPage.getByTestId("page-status")).toHaveText("Published");
  const replayPublish = await runtime.fetch(publish.path, {
    role: "member", method: "POST", headers: { "content-type": publish.headers["content-type"] },
    body: publish.body.replaceAll(memberPageId, draftId),
  });
  expect(replayPublish.status).not.toBe(401);
  expect((await db.prepare("SELECT status FROM pages WHERE id = ?").bind(draftId).first()).status).toBe("draft");
  await memberPage.goto("/products");
  const del = await captureServerCall(memberPage, async () => {
    await memberPage.getByRole("button", { name: "Delete Member Lantern" }).click();
    await memberPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  });
  await expect(memberPage.getByTestId("form-error")).toContainText("in use");
  await runtime.fetch(del.path, {
    role: "member", method: "POST", headers: { "content-type": del.headers["content-type"] },
    body: del.body.replaceAll(lantern.id, shell.id),
  });
  await runtime.fetch(del.path, {
    role: "member", method: "POST", headers: { "content-type": del.headers["content-type"] },
    body: del.body.replaceAll(lantern.id, socks.id),
  });
  expect((await db.prepare("SELECT count(*) AS n FROM products WHERE owner_id <> (SELECT owner_id FROM products WHERE id = ?)").bind(lantern.id).first()).n).toBe(2);
  // The outsider gets nothing through a captured call either.
  const outsider = await runtime.fetch(publish.path, {
    role: "outsider", method: "POST", headers: { "content-type": publish.headers["content-type"] }, body: publish.body,
  });
  expect(outsider.status).toBeGreaterThanOrEqual(400);

  // Slugs are unique across members.
  await memberPage.goto(`/pages/${memberPageId}`);
  await memberPage.getByLabel("Slug").fill("shell-launch");
  await memberPage.getByRole("button", { name: "Save settings" }).click();
  await expect(memberPage.getByTestId("form-error")).toContainText("taken");
  expect(await (await runtime.fetch("/s/shell-launch")).text()).toContain("Stay dry on the ridge");

  // Admin-only: the moderation list of every member's published pages.
  await memberPage.goto("/published");
  await expect(memberPage.getByTestId("admin-only")).toBeVisible();
  await expect(memberPage.getByText("Shell launch")).toHaveCount(0);
  await ownerPage.goto("/published");
  const lanternRow = ownerPage.getByTestId("published-row").filter({ hasText: "Lantern page" });
  await expect(lanternRow).toBeVisible();
  await lanternRow.getByRole("button", { name: "Unpublish" }).click();
  await expect(lanternRow).toHaveCount(0);
  expect((await db.prepare("SELECT status FROM pages WHERE id = ?").bind(memberPageId).first()).status).toBe("draft");
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
