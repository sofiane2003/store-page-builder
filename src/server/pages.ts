import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pageMessages, pages, products, savedSections } from "@/db/schema";
import { UserError } from "@/server/errors";
import { getBrand } from "@/server/brand";
import { getProduct } from "@/server/products";
import {
  blankContent,
  countdownRunning,
  pageTypeIds,
  parseContent,
  parseSections,
  presetIds,
  SECTION_KINDS,
  slugify,
  slugSchema,
  type Section,
} from "@/lib/sections";

export const createPageInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  productId: z.string().uuid("Pick a product"),
  type: z.enum(pageTypeIds),
  language: z.string().trim().max(40).optional(),
  angle: z.string().trim().max(2000).default(""),
});
export const pageSettingsInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: slugSchema,
  language: z.string().trim().min(1, "Language is required").max(40),
  preset: z.enum(presetIds),
  productId: z.string().uuid(),
  type: z.enum(pageTypeIds),
});
export const sectionContentInput = z.object({
  pageId: z.string().uuid(),
  sectionId: z.string().min(1).max(64),
  content: z.record(z.string(), z.unknown()),
});
export const addSectionInput = z.object({ pageId: z.string().uuid(), kind: z.enum(SECTION_KINDS) });
export const moveSectionInput = z.object({
  pageId: z.string().uuid(),
  sectionId: z.string().min(1).max(64),
  direction: z.enum(["up", "down"]),
});
export const sectionRefInput = z.object({ pageId: z.string().uuid(), sectionId: z.string().min(1).max(64) });
export const pageIdInput = z.object({ id: z.string().uuid() });
export const statusInput = z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) });

type PageRow = typeof pages.$inferSelect;

export async function listPages(ownerId: string) {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      type: pages.type,
      status: pages.status,
      updatedAt: pages.updatedAt,
      productName: products.name,
    })
    .from(pages)
    .leftJoin(products, eq(products.id, pages.productId))
    .where(eq(pages.ownerId, ownerId))
    .orderBy(desc(pages.updatedAt));
}

async function ownPage(ownerId: string, id: string): Promise<PageRow> {
  const [row] = await db.select().from(pages).where(and(eq(pages.id, id), eq(pages.ownerId, ownerId)));
  if (!row) throw new UserError("Page not found");
  return row;
}

/** The page with its sections and AI history, or null for anyone but its owner. */
export async function getPage(ownerId: string, id: string) {
  const [row] = await db.select().from(pages).where(and(eq(pages.id, id), eq(pages.ownerId, ownerId)));
  if (!row) return null;
  const messages = await db
    .select({ id: pageMessages.id, sectionId: pageMessages.sectionId, role: pageMessages.role, text: pageMessages.text })
    .from(pageMessages)
    .where(eq(pageMessages.pageId, id))
    .orderBy(asc(pageMessages.createdAt), asc(pageMessages.id));
  const { sections, ownerId: _owner, ...page } = row;
  return { ...page, sections: parseSections(sections), messages };
}

async function freeSlug(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug));
    if (!taken) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createPage(
  ownerId: string,
  input: z.infer<typeof createPageInput>,
  sections: Section[] = [],
): Promise<string> {
  const product = await getProduct(ownerId, input.productId);
  if (!product) throw new UserError("Pick one of your products");
  const brand = await getBrand(ownerId);
  const id = crypto.randomUUID();
  await db.insert(pages).values({
    id,
    ownerId,
    productId: product.id,
    type: input.type,
    title: input.title,
    slug: await freeSlug(slugify(input.title)),
    language: input.language || brand.language,
    preset: brand.preset,
    sections: JSON.stringify(sections),
  });
  return id;
}

/**
 * Writes new sections only if the page hasn't changed since `before` was
 * read, so two edits never overwrite each other.
 */
async function writeSections(ownerId: string, before: PageRow, sections: Section[]): Promise<void> {
  const [row] = await db
    .update(pages)
    .set({ sections: JSON.stringify(sections), updatedAt: new Date().toISOString() })
    .where(and(eq(pages.id, before.id), eq(pages.ownerId, ownerId), eq(pages.updatedAt, before.updatedAt)))
    .returning({ id: pages.id });
  if (!row) throw new UserError("The page changed meanwhile. Reload and try again.");
}

export async function updateSettings(ownerId: string, input: z.infer<typeof pageSettingsInput>) {
  const page = await ownPage(ownerId, input.id);
  if (!(await getProduct(ownerId, input.productId))) throw new UserError("Pick one of your products");
  const [taken] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, input.slug));
  if (taken && taken.id !== page.id) throw new UserError("That slug is taken. Try another.");
  const { id, ...values } = input;
  await db
    .update(pages)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(pages.id, id), eq(pages.ownerId, ownerId)));
}

export async function saveSectionContent(ownerId: string, input: z.infer<typeof sectionContentInput>) {
  const page = await ownPage(ownerId, input.pageId);
  const sections = parseSections(page.sections);
  const section = sections.find((s) => s.id === input.sectionId);
  if (!section) throw new UserError("Section not found");
  let content;
  try {
    content = parseContent(section.kind, input.content);
  } catch {
    throw new UserError("Some fields aren't valid. Check the stars are 1 to 5.");
  }
  await writeSections(
    ownerId,
    page,
    sections.map((s) => (s.id === section.id ? { ...s, content } : s)),
  );
}

export async function replaceSection(ownerId: string, pageId: string, section: Section) {
  const page = await ownPage(ownerId, pageId);
  const sections = parseSections(page.sections);
  if (!sections.some((s) => s.id === section.id)) throw new UserError("Section not found");
  await writeSections(ownerId, page, sections.map((s) => (s.id === section.id ? section : s)));
}

export async function addSection(ownerId: string, input: z.infer<typeof addSectionInput>) {
  const page = await ownPage(ownerId, input.pageId);
  const sections = parseSections(page.sections);
  if (sections.length >= 40) throw new UserError("A page can have up to 40 sections");
  await writeSections(ownerId, page, [
    ...sections,
    { id: crypto.randomUUID(), kind: input.kind, content: blankContent(input.kind) },
  ]);
}

export async function insertSaved(ownerId: string, pageId: string, savedId: string) {
  const [saved] = await db
    .select()
    .from(savedSections)
    .where(and(eq(savedSections.id, savedId), eq(savedSections.ownerId, ownerId)));
  if (!saved) throw new UserError("Saved section not found");
  const kind = z.enum(SECTION_KINDS).parse(saved.kind);
  const page = await ownPage(ownerId, pageId);
  const sections = parseSections(page.sections);
  await writeSections(ownerId, page, [
    ...sections,
    { id: crypto.randomUUID(), kind, content: parseContent(kind, JSON.parse(saved.content)) },
  ]);
}

export async function moveSection(ownerId: string, input: z.infer<typeof moveSectionInput>) {
  const page = await ownPage(ownerId, input.pageId);
  const sections = parseSections(page.sections);
  const from = sections.findIndex((s) => s.id === input.sectionId);
  if (from < 0) throw new UserError("Section not found");
  const to = input.direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= sections.length) return;
  [sections[from], sections[to]] = [sections[to]!, sections[from]!];
  await writeSections(ownerId, page, sections);
}

export async function deleteSection(ownerId: string, input: z.infer<typeof sectionRefInput>) {
  const page = await ownPage(ownerId, input.pageId);
  const sections = parseSections(page.sections);
  await writeSections(ownerId, page, sections.filter((s) => s.id !== input.sectionId));
  await db
    .delete(pageMessages)
    .where(and(eq(pageMessages.pageId, page.id), eq(pageMessages.sectionId, input.sectionId)));
}

export async function setStatus(ownerId: string, input: z.infer<typeof statusInput>) {
  const [row] = await db
    .update(pages)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(and(eq(pages.id, input.id), eq(pages.ownerId, ownerId)))
    .returning({ id: pages.id });
  if (!row) throw new UserError("Page not found");
}

export async function deletePage(ownerId: string, id: string) {
  const page = await ownPage(ownerId, id);
  await db.batch([
    db.delete(pageMessages).where(eq(pageMessages.pageId, page.id)),
    db.delete(pages).where(and(eq(pages.id, page.id), eq(pages.ownerId, ownerId))),
  ]);
}

export async function addMessages(pageId: string, sectionId: string, items: { role: string; text: string }[]) {
  const base = Date.now();
  await db.insert(pageMessages).values(
    items.map((m, i) => ({
      id: crypto.randomUUID(),
      pageId,
      sectionId,
      role: m.role,
      text: m.text,
      createdAt: new Date(base + i).toISOString(),
    })),
  );
}

export async function pageForAi(ownerId: string, id: string) {
  const page = await ownPage(ownerId, id);
  return { page, sections: parseSections(page.sections) };
}

/** A published page as anyone may see it: no ids, owner or draft data. */
export async function getPublishedPage(slug: string) {
  const [row] = await db
    .select({
      title: pages.title,
      language: pages.language,
      preset: pages.preset,
      sections: pages.sections,
      name: products.name,
      priceCents: products.priceCents,
      currency: products.currency,
      description: products.description,
      imageKey: products.imageKey,
      buyUrl: products.buyUrl,
    })
    .from(pages)
    .innerJoin(products, eq(products.id, pages.productId))
    .where(and(eq(pages.slug, slug), eq(pages.status, "published")));
  if (!row) return null;
  const sections = parseSections(row.sections)
    .filter((s) => s.kind !== "countdown" || countdownRunning(s.content))
    .map(({ kind, content }, i) => ({ id: String(i), kind, content }));
  return {
    title: row.title,
    language: row.language,
    preset: row.preset,
    sections,
    product: {
      name: row.name,
      priceCents: row.priceCents,
      currency: row.currency,
      description: row.description,
      imageUrl: row.imageKey ? `/f/${row.imageKey}` : null,
      buyUrl: row.buyUrl,
    },
  };
}
export type PublicPage = NonNullable<Awaited<ReturnType<typeof getPublishedPage>>>;

/** Every member's published pages, for admins. */
export function listAllPublished() {
  return db
    .select({ id: pages.id, title: pages.title, slug: pages.slug, updatedAt: pages.updatedAt })
    .from(pages)
    .where(eq(pages.status, "published"))
    .orderBy(desc(pages.updatedAt));
}

export async function adminUnpublish(id: string) {
  await db.update(pages).set({ status: "draft", updatedAt: new Date().toISOString() }).where(eq(pages.id, id));
}

export async function setShopifyPageId(ownerId: string, id: string, shopifyPageId: string) {
  await db
    .update(pages)
    .set({ shopifyPageId })
    .where(and(eq(pages.id, id), eq(pages.ownerId, ownerId)));
}
