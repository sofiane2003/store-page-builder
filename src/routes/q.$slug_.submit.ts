import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { slugSchema } from "@/lib/sections";
import { submitQuiz } from "@/server/quizzes";

// A shopper's answers to a published quiz, from anyone (everyapp.config.ts).
// The server scores them from the stored points; the client sends only
// which answer it picked for each question.
const body = z.object({ answers: z.array(z.number().int().min(0).max(50)).max(30) });

export const Route = createFileRoute("/q/$slug_/submit")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { slug: string } }) => {
        const slug = slugSchema.safeParse(params.slug);
        if (!slug.success) return Response.json({ error: "Not found" }, { status: 404 });
        const parsed = body.safeParse(await request.json().catch(() => null));
        const product = await submitQuiz(slug.data, parsed.success ? parsed.data.answers : []);
        if (product === null) return Response.json({ error: "Not found" }, { status: 404 });
        if (!parsed.success || product === "invalid") return Response.json({ error: "Answer every question" }, { status: 400 });
        return Response.json({ product });
      },
    },
  },
});
