import { env } from "cloudflare:workers";
import { createGatewayFetch, integrationStatus } from "@every-app/sdk/server";
import { renderPageHtml } from "@/lib/html";
import type { PublicPage } from "@/server/pages";

const API_VERSION = "2026-01";

/** Whether the Gateway holds a Shopify key for this app. */
export async function shopifyReady(): Promise<boolean> {
  try {
    const status = await integrationStatus({ env, provider: "shopify" });
    return Boolean(status.ready);
  } catch {
    return false;
  }
}

type PageResult = { page: { id: string } | null; userErrors: { message: string }[] };

/** Creates or updates the page as an online-store page; returns its Shopify id. */
export async function pushPage(input: {
  store: string;
  shopifyPageId: string | null;
  slug: string;
  page: PublicPage;
  origin: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // The Gateway's capability route for the store's own host. integrationFetch()
  // in the pinned SDK only allows a provider's fixed hosts, and Shopify has
  // none (its host is the SHOPIFY_HOST setting), so the call goes over the
  // same attributed binding to /api/integrations/shopify/<host>/<path>.
  const gateway = createGatewayFetch({ env });
  const fields = { title: input.page.title, handle: input.slug, body: renderPageHtml(input.page, input.origin), isPublished: true };
  const query = input.shopifyPageId
    ? "mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id } userErrors { message } } }"
    : "mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id } userErrors { message } } }";
  const variables = input.shopifyPageId ? { id: input.shopifyPageId, page: fields } : { page: fields };
  let response: Response;
  try {
    response = await gateway(`https://every-app-gateway.internal/api/integrations/shopify/${input.store}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    return { ok: false, error: "Shopify couldn't be reached." };
  }
  if (!response.ok) return { ok: false, error: `Shopify refused the page (${response.status}). Check the store address in Brand.` };
  const body = (await response.json()) as { data?: { pageCreate?: PageResult; pageUpdate?: PageResult } };
  const result = body.data?.pageUpdate ?? body.data?.pageCreate;
  if (!result?.page) return { ok: false, error: result?.userErrors[0]?.message ?? "Shopify didn't take the page." };
  return { ok: true, id: result.page.id };
}
