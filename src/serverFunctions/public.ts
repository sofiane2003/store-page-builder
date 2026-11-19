import { createServerFn } from "@tanstack/react-start";
import { slugSchema } from "@/lib/sections";
import { getPublishedPage } from "@/server/pages";
import { getPublishedQuiz } from "@/server/quizzes";

// The only server functions without a member: what /s/<slug> and /q/<slug>
// show anyone, published content only.
export const getPublicPage = createServerFn()
  .validator((data: unknown) => slugSchema.parse(data))
  .handler(({ data }) => getPublishedPage(data));

export const getPublicQuiz = createServerFn()
  .validator((data: unknown) => slugSchema.parse(data))
  .handler(({ data }) => getPublishedQuiz(data));
