import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as quizzes from "@/server/quizzes";
import { listProducts } from "@/server/products";

export const getQuizzes = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => quizzes.listQuizzes(context.user.id));

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => quizzes.createQuizInput.parse(data))
  .handler(async ({ data, context }) => ({ id: await quizzes.createQuiz(context.user.id, data) }));

export const getQuizEditor = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const quiz = await quizzes.getQuiz(context.user.id, data.id);
    if (!quiz) return null;
    const products = await listProducts(context.user.id);
    return {
      quiz,
      products: products.map((p) => ({ id: p.id, name: p.name })),
      origin: new URL(getRequest().url).origin,
    };
  });

export const saveQuiz = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => quizzes.saveQuizInput.parse(data))
  .handler(({ data, context }) => quizzes.saveQuiz(context.user.id, data));

export const setQuizStatus = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => quizzes.quizStatusInput.parse(data))
  .handler(({ data, context }) => quizzes.setQuizStatus(context.user.id, data));

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data, context }) => quizzes.deleteQuiz(context.user.id, data.id));
