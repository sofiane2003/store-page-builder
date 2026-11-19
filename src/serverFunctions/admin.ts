import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import { memberMiddleware } from "@/serverFunctions/middleware";
import { UserError } from "@/server/errors";
import { adminUnpublish, listAllPublished } from "@/server/pages";
import { adminUnpublishQuiz, listAllPublishedQuizzes } from "@/server/quizzes";

/** Every member's published pages and quizzes; admins only. */
export const getPublished = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    if (!isAdmin(context.user)) return { admin: false as const };
    const [pages, quizzes] = await Promise.all([listAllPublished(), listAllPublishedQuizzes()]);
    return { admin: true as const, pages, quizzes };
  });

export const unpublishAny = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid(), what: z.enum(["page", "quiz"]) }).parse(data))
  .handler(async ({ data, context }) => {
    if (!isAdmin(context.user)) throw new UserError("Only admins can do that.");
    if (data.what === "page") await adminUnpublish(data.id);
    else await adminUnpublishQuiz(data.id);
  });
