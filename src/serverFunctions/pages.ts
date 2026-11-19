import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { memberMiddleware } from "@/serverFunctions/middleware";
import { generateSections, reviseSection } from "@/server/ai";
import { getBrand } from "@/server/brand";
import { UserError } from "@/server/errors";
import * as pages from "@/server/pages";
import { getProduct, listProducts } from "@/server/products";
import { listSaved } from "@/server/library";
import { pushPage, shopifyReady } from "@/server/shopify";

export const getPages = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const [list, products, brand] = await Promise.all([
      pages.listPages(context.user.id),
      listProducts(context.user.id),
      getBrand(context.user.id),
    ]);
    return { pages: list, products: products.map((p) => ({ id: p.id, name: p.name })), language: brand.language };
  });

export const getPageEditor = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.pageIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const page = await pages.getPage(context.user.id, data.id);
    if (!page) return null;
    const [products, saved, shopify, brand] = await Promise.all([
      listProducts(context.user.id),
      listSaved(context.user.id),
      shopifyReady(),
      getBrand(context.user.id),
    ]);
    return {
      page,
      products,
      saved: saved.map((s) => ({ id: s.id, name: s.name })),
      shopify: { ready: shopify, store: brand.shopifyStore },
      origin: new URL(getRequest().url).origin,
    };
  });

export const createBlankPage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.createPageInput.parse(data))
  .handler(async ({ data, context }) => ({ id: await pages.createPage(context.user.id, data) }));

/** Writes a whole page with the AI; nothing is saved unless every section is valid. */
export const generatePage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.createPageInput.parse(data))
  .handler(async ({ data, context }) => {
    const product = await getProduct(context.user.id, data.productId);
    if (!product) throw new UserError("Pick one of your products");
    const brand = await getBrand(context.user.id);
    const result = await generateSections({
      brand,
      product,
      type: data.type,
      language: data.language || brand.language,
      angle: data.angle,
    });
    if (!result.ok) return result;
    const id = await pages.createPage(context.user.id, data, result.value);
    return { ok: true as const, id };
  });

export const askAi = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) =>
    pages.sectionRefInput.extend({ instruction: z.string().trim().min(1, "Type an instruction").max(1000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.user.id;
    const { page, sections } = await pages.pageForAi(userId, data.pageId);
    const section = sections.find((s) => s.id === data.sectionId);
    if (!section) throw new UserError("Section not found");
    const product = await getProduct(userId, page.productId);
    if (!product) throw new UserError("The page's product is gone");
    const editor = await pages.getPage(userId, page.id);
    const result = await reviseSection({
      brand: await getBrand(userId),
      product,
      language: page.language,
      section,
      history: (editor?.messages ?? []).filter((m) => m.sectionId === section.id),
      instruction: data.instruction,
    });
    if (!result.ok) return result;
    await pages.replaceSection(userId, page.id, result.value);
    await pages.addMessages(page.id, section.id, [
      { role: "user", text: data.instruction },
      { role: "assistant", text: "Rewrote the section." },
    ]);
    return { ok: true as const };
  });

export const updatePageSettings = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.pageSettingsInput.parse(data))
  .handler(({ data, context }) => pages.updateSettings(context.user.id, data));

export const saveSection = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.sectionContentInput.parse(data))
  .handler(({ data, context }) => pages.saveSectionContent(context.user.id, data));

export const addSection = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.addSectionInput.parse(data))
  .handler(({ data, context }) => pages.addSection(context.user.id, data));

export const insertSaved = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ pageId: z.string().uuid(), savedId: z.string().uuid() }).parse(data))
  .handler(({ data, context }) => pages.insertSaved(context.user.id, data.pageId, data.savedId));

export const moveSection = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.moveSectionInput.parse(data))
  .handler(({ data, context }) => pages.moveSection(context.user.id, data));

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.sectionRefInput.parse(data))
  .handler(({ data, context }) => pages.deleteSection(context.user.id, data));

export const setPageStatus = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.statusInput.parse(data))
  .handler(({ data, context }) => pages.setStatus(context.user.id, data));

export const deletePage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.pageIdInput.parse(data))
  .handler(({ data, context }) => pages.deletePage(context.user.id, data.id));

export const pushToShopify = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => pages.pageIdInput.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.user.id;
    const brand = await getBrand(userId);
    if (!brand.shopifyStore) throw new UserError("Add your store's address in Brand first.");
    const editor = await pages.getPage(userId, data.id);
    if (!editor) throw new UserError("Page not found");
    const product = await getProduct(userId, editor.productId);
    if (!product) throw new UserError("The page's product is gone");
    const pushed = await pushPage({
      store: brand.shopifyStore,
      shopifyPageId: editor.shopifyPageId,
      slug: editor.slug,
      origin: new URL(getRequest().url).origin,
      page: {
        title: editor.title,
        language: editor.language,
        preset: editor.preset,
        sections: editor.sections,
        product: {
          name: product.name,
          priceCents: product.priceCents,
          currency: product.currency,
          description: product.description,
          imageUrl: product.imageKey ? `/f/${product.imageKey}` : null,
          buyUrl: product.buyUrl,
        },
      },
    });
    if (!pushed.ok) throw new UserError(pushed.error);
    await pages.setShopifyPageId(userId, editor.id, pushed.id);
    return { updated: Boolean(editor.shopifyPageId) };
  });
