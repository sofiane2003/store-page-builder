import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { products, quizProducts, quizResponses, quizzes } from "@/db/schema";
import { UserError } from "@/server/errors";
import { productsById } from "@/server/products";
import { quizQuestionsSchema, scoreQuiz } from "@/lib/quiz";
import { slugify, slugSchema } from "@/lib/sections";

export const createQuizInput = z.object({ title: z.string().trim().min(1, "Title is required").max(200) });
export const saveQuizInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  intro: z.string().trim().max(2000),
  slug: slugSchema,
  questions: quizQuestionsSchema,
});
export const quizStatusInput = z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) });

export async function listQuizzes(ownerId: string) {
  const rows = await db
    .select({ id: quizzes.id, title: quizzes.title, slug: quizzes.slug, status: quizzes.status, updatedAt: quizzes.updatedAt })
    .from(quizzes)
    .where(eq(quizzes.ownerId, ownerId))
    .orderBy(desc(quizzes.updatedAt));
  const counts = await db
    .select({ quizId: quizResponses.quizId, n: count() })
    .from(quizResponses)
    .innerJoin(quizzes, eq(quizzes.id, quizResponses.quizId))
    .where(eq(quizzes.ownerId, ownerId))
    .groupBy(quizResponses.quizId);
  const byQuiz = new Map(counts.map((c) => [c.quizId, c.n]));
  return rows.map((r) => ({ ...r, responses: byQuiz.get(r.id) ?? 0 }));
}

async function freeSlug(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.slug, slug));
    if (!taken) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createQuiz(ownerId: string, input: z.infer<typeof createQuizInput>): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(quizzes).values({ id, ownerId, title: input.title, slug: await freeSlug(slugify(input.title)) });
  return id;
}

/** The quiz with how many responses ended at each product, or null for anyone but its owner. */
export async function getQuiz(ownerId: string, id: string) {
  const [row] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.ownerId, ownerId)));
  if (!row) return null;
  const results = await db
    .select({ productId: quizResponses.resultProductId, name: products.name, n: count() })
    .from(quizResponses)
    .leftJoin(products, eq(products.id, quizResponses.resultProductId))
    .where(eq(quizResponses.quizId, id))
    .groupBy(quizResponses.resultProductId);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    intro: row.intro,
    status: row.status,
    questions: quizQuestionsSchema.parse(JSON.parse(row.questions)),
    results: results.map((r) => ({ productId: r.productId, name: r.name ?? "Deleted product", responses: r.n })),
  };
}

export async function saveQuiz(ownerId: string, input: z.infer<typeof saveQuizInput>) {
  const [quiz] = await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, input.id), eq(quizzes.ownerId, ownerId)));
  if (!quiz) throw new UserError("Quiz not found");
  const used = [...new Set(input.questions.flatMap((q) => q.answers.map((a) => a.productId)))];
  const owned = await productsById(ownerId, used);
  if (owned.size !== used.length) throw new UserError("Every answer must point to one of your products");
  const [taken] = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.slug, input.slug));
  if (taken && taken.id !== quiz.id) throw new UserError("That slug is taken. Try another.");
  await db.batch([
    db
      .update(quizzes)
      .set({
        title: input.title,
        intro: input.intro,
        slug: input.slug,
        questions: JSON.stringify(input.questions),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(quizzes.id, quiz.id), eq(quizzes.ownerId, ownerId))),
    db.delete(quizProducts).where(eq(quizProducts.quizId, quiz.id)),
    ...used.map((productId) => db.insert(quizProducts).values({ quizId: quiz.id, productId })),
  ]);
}

export async function setQuizStatus(ownerId: string, input: z.infer<typeof quizStatusInput>) {
  const quiz = await getQuiz(ownerId, input.id);
  if (!quiz) throw new UserError("Quiz not found");
  if (input.status === "published" && quiz.questions.length === 0) {
    throw new UserError("Add a question before publishing");
  }
  await db
    .update(quizzes)
    .set({ status: input.status, updatedAt: new Date().toISOString() })
    .where(and(eq(quizzes.id, input.id), eq(quizzes.ownerId, ownerId)));
}

export async function deleteQuiz(ownerId: string, id: string) {
  const [quiz] = await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.ownerId, ownerId)));
  if (!quiz) throw new UserError("Quiz not found");
  await db.batch([
    db.delete(quizResponses).where(eq(quizResponses.quizId, id)),
    db.delete(quizProducts).where(eq(quizProducts.quizId, id)),
    db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.ownerId, ownerId))),
  ]);
}

async function publishedQuiz(slug: string) {
  const [row] = await db.select().from(quizzes).where(and(eq(quizzes.slug, slug), eq(quizzes.status, "published")));
  if (!row) return null;
  return { row, questions: quizQuestionsSchema.parse(JSON.parse(row.questions)) };
}

/** A published quiz as shoppers see it: no points, products or owner. */
export async function getPublishedQuiz(slug: string) {
  const quiz = await publishedQuiz(slug);
  if (!quiz) return null;
  return {
    title: quiz.row.title,
    intro: quiz.row.intro,
    questions: quiz.questions.map((q) => ({ text: q.text, answers: q.answers.map((a) => a.text) })),
  };
}

/** Scores the answers, records the response and returns the product. Null: no such quiz; "invalid": the answers don't fit. */
export async function submitQuiz(slug: string, picks: number[]) {
  const quiz = await publishedQuiz(slug);
  if (!quiz) return null;
  const productId = scoreQuiz(quiz.questions, picks);
  if (!productId) return "invalid" as const;
  const product = (await productsById(quiz.row.ownerId, [productId])).get(productId);
  if (!product) return "invalid" as const;
  await db.insert(quizResponses).values({
    id: crypto.randomUUID(),
    quizId: quiz.row.id,
    resultProductId: productId,
    answers: JSON.stringify(picks),
  });
  return {
    name: product.name,
    description: product.description,
    price: product.priceCents,
    currency: product.currency,
    imageUrl: product.imageKey ? `/f/${product.imageKey}` : null,
    buyUrl: product.buyUrl,
  };
}

export function listAllPublishedQuizzes() {
  return db
    .select({ id: quizzes.id, title: quizzes.title, slug: quizzes.slug, updatedAt: quizzes.updatedAt })
    .from(quizzes)
    .where(eq(quizzes.status, "published"))
    .orderBy(desc(quizzes.updatedAt));
}

export async function adminUnpublishQuiz(id: string) {
  await db.update(quizzes).set({ status: "draft", updatedAt: new Date().toISOString() }).where(eq(quizzes.id, id));
}
