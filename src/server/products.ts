import { and, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { pages, products, quizProducts, quizzes } from "@/db/schema";
import { UserError } from "@/server/errors";

export const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  price: z.coerce.number().min(0, "Price can't be negative").max(1_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency is a three-letter code such as USD"),
  description: z.string().trim().max(5000).default(""),
  buyUrl: z
    .string()
    .trim()
    .url("Buy link must be a full URL")
    .regex(/^https?:\/\//, "Buy link must start with http"),
});

const shown = {
  id: products.id,
  name: products.name,
  priceCents: products.priceCents,
  currency: products.currency,
  description: products.description,
  imageKey: products.imageKey,
  buyUrl: products.buyUrl,
  updatedAt: products.updatedAt,
};
export type Product = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  description: string;
  imageKey: string | null;
  buyUrl: string;
  updatedAt: string;
};

export function listProducts(ownerId: string): Promise<Product[]> {
  return db.select(shown).from(products).where(eq(products.ownerId, ownerId)).orderBy(products.name);
}

export async function getProduct(ownerId: string, id: string): Promise<Product | null> {
  const [row] = await db
    .select(shown)
    .from(products)
    .where(and(eq(products.id, id), eq(products.ownerId, ownerId)));
  return row ?? null;
}

export async function saveProduct(ownerId: string, input: z.infer<typeof productInput>): Promise<Product> {
  const values = {
    name: input.name,
    priceCents: Math.round(input.price * 100),
    currency: input.currency,
    description: input.description,
    buyUrl: input.buyUrl,
  };
  if (input.id) {
    const [row] = await db
      .update(products)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(and(eq(products.id, input.id), eq(products.ownerId, ownerId)))
      .returning(shown);
    if (!row) throw new UserError("Product not found");
    return row;
  }
  const [row] = await db
    .insert(products)
    .values({ id: crypto.randomUUID(), ownerId, ...values })
    .returning(shown);
  return row!;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const imageInput = z.object({
  id: z.string().uuid(),
  contentType: z.enum(IMAGE_TYPES, { message: "Use a PNG, JPEG, WebP or GIF image" }),
  // Base64, up to about 4 MB of image.
  data: z.string().min(1).max(5_600_000, "Images can be up to 4 MB"),
});

/** Stores the product's one image in R2, replacing the old one. */
export async function setProductImage(ownerId: string, input: z.infer<typeof imageInput>): Promise<Product> {
  const product = await getProduct(ownerId, input.id);
  if (!product) throw new UserError("Product not found");
  const bytes = Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0));
  const key = `products/${product.id}/${crypto.randomUUID()}`;
  await env.files.put(key, bytes, { httpMetadata: { contentType: input.contentType } });
  const [row] = await db
    .update(products)
    .set({ imageKey: key, updatedAt: new Date().toISOString() })
    .where(and(eq(products.id, product.id), eq(products.ownerId, ownerId)))
    .returning(shown);
  if (product.imageKey) await env.files.delete(product.imageKey);
  return row!;
}

/** Deletes a product no page or quiz uses. */
export async function deleteProduct(ownerId: string, id: string): Promise<void> {
  const product = await getProduct(ownerId, id);
  if (!product) throw new UserError("Product not found");
  const [page] = await db
    .select({ title: pages.title })
    .from(pages)
    .where(and(eq(pages.productId, id), eq(pages.ownerId, ownerId)))
    .limit(1);
  if (page) throw new UserError(`This product is in use by the page “${page.title}”.`);
  const [quiz] = await db
    .select({ title: quizzes.title })
    .from(quizProducts)
    .innerJoin(quizzes, eq(quizzes.id, quizProducts.quizId))
    .where(and(eq(quizProducts.productId, id), eq(quizzes.ownerId, ownerId)))
    .limit(1);
  if (quiz) throw new UserError(`This product is in use by the quiz “${quiz.title}”.`);
  await db.delete(products).where(and(eq(products.id, id), eq(products.ownerId, ownerId)));
  if (product.imageKey) await env.files.delete(product.imageKey);
}

/** The owner's products among `ids`, by id. */
export async function productsById(ownerId: string, ids: string[]): Promise<Map<string, Product>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select(shown)
    .from(products)
    .where(and(eq(products.ownerId, ownerId), inArray(products.id, ids)));
  return new Map(rows.map((r) => [r.id, r]));
}
