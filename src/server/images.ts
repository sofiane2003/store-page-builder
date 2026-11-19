import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pages, products, quizProducts, quizzes } from "@/db/schema";

/**
 * Whether the image at `key` may be shown: to the product's owner, and to
 * anyone once a published page or quiz uses the product.
 */
export async function imageVisible(key: string, userId: string | null): Promise<boolean> {
  const [product] = await db.select({ id: products.id, ownerId: products.ownerId }).from(products).where(eq(products.imageKey, key));
  if (!product) return false;
  if (userId && product.ownerId === userId) return true;
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.productId, product.id), eq(pages.status, "published")))
    .limit(1);
  if (page) return true;
  const [quiz] = await db
    .select({ id: quizzes.id })
    .from(quizProducts)
    .innerJoin(quizzes, eq(quizzes.id, quizProducts.quizId))
    .where(and(eq(quizProducts.productId, product.id), eq(quizzes.status, "published")))
    .limit(1);
  return Boolean(quiz);
}
