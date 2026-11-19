import { z } from "zod";

export const quizQuestionsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      text: z.string().trim().min(1, "Every question needs text").max(300),
      answers: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            text: z.string().trim().min(1, "Every answer needs text").max(200),
            productId: z.string().uuid("Pick a product for every answer"),
            points: z.coerce.number().int().min(0).max(100),
          }),
        )
        .min(1, "Every question needs an answer")
        .max(12),
    }),
  )
  .max(30);
export type QuizQuestions = z.infer<typeof quizQuestionsSchema>;

/**
 * The product the answers point to: one answer index per question, in
 * order. Ties go to the product that scored first. Null when the answers
 * don't fit the quiz.
 */
export function scoreQuiz(questions: QuizQuestions, picks: number[]): string | null {
  if (questions.length === 0 || picks.length !== questions.length) return null;
  const totals = new Map<string, number>();
  for (const [i, question] of questions.entries()) {
    const pick = picks[i];
    if (!Number.isInteger(pick)) return null;
    const answer = question.answers[pick!];
    if (!answer) return null;
    totals.set(answer.productId, (totals.get(answer.productId) ?? 0) + answer.points);
  }
  let best: string | null = null;
  let bestScore = -1;
  for (const [productId, score] of totals) {
    if (score > bestScore) {
      best = productId;
      bestScore = score;
    }
  }
  return best;
}
