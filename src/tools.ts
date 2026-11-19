// The app's tools for AI clients, served by the Gateway at /mcp with the
// signed-in user. Read-only: an assistant can look up what a member has.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { listPages } from "@/server/pages";
import { listProducts } from "@/server/products";

export const tools = defineTools({
  list_products: {
    description: "List the user's products with price, currency and buy link.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) =>
      (await listProducts(user.id)).map(({ name, priceCents, currency, buyUrl }) => ({
        name,
        price: priceCents / 100,
        currency,
        buyUrl,
      })),
  },
  list_pages: {
    description: "List the user's store pages with type, product, status and public path.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async (_input, { user }) =>
      (await listPages(user.id)).map((p) => ({
        title: p.title,
        type: p.type,
        product: p.productName,
        status: p.status,
        path: `/s/${p.slug}`,
      })),
  },
});
