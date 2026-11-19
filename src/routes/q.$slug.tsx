import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Progress } from "@/client/components/ui/progress";
import { formatPrice } from "@/lib/sections";
import { getPublicQuiz } from "@/serverFunctions/public";

// A published quiz, open to anyone (everyapp.config.ts lists /q/:slug).
export const Route = createFileRoute("/q/$slug")({
  loader: async ({ params }) => {
    const quiz = await getPublicQuiz({ data: params.slug }).catch(() => null);
    if (!quiz) throw notFound();
    return quiz;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.title }] : [] }),
  notFoundComponent: () => (
    <div className="flex h-dvh items-center justify-center p-6 text-center text-muted-foreground">
      <p>This quiz isn't available.</p>
    </div>
  ),
  component: PublicQuiz,
});

interface Result {
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  buyUrl: string;
}

function PublicQuiz() {
  const quiz = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(index: number) {
    const next = [...answers, index];
    setAnswers(next);
    if (next.length < quiz.questions.length) {
      setStep(step + 1);
      return;
    }
    setStep(quiz.questions.length);
    const response = await fetch(`/q/${slug}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: next }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Something went wrong. Try again.");
      return;
    }
    setResult(((await response.json()) as { product: Result }).product);
  }

  function restart() {
    setAnswers([]);
    setResult(null);
    setError(null);
    setStep(0);
  }

  const question = quiz.questions[step];
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 px-5 py-10">
        {step === -1 ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{quiz.title}</h1>
            {quiz.intro ? <p className="text-lg text-muted-foreground">{quiz.intro}</p> : null}
            <Button size="lg" onClick={() => setStep(0)}>
              Start
            </Button>
          </>
        ) : question ? (
          <>
            <Progress value={(step / quiz.questions.length) * 100} />
            <h1 className="text-2xl font-semibold">{question.text}</h1>
            <div className="grid gap-3">
              {question.answers.map((text, i) => (
                <Button key={i} variant="outline" size="lg" className="h-auto min-h-12 justify-start py-3 text-left whitespace-normal" onClick={() => answer(i)}>
                  {text}
                </Button>
              ))}
            </div>
          </>
        ) : error ? (
          <>
            <p className="text-destructive">{error}</p>
            <Button onClick={restart}>Start over</Button>
          </>
        ) : result ? (
          <div data-testid="quiz-result" className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Your match</p>
            {result.imageUrl ? <img src={result.imageUrl} alt={result.name} className="mx-auto aspect-square w-64 rounded-xl object-cover" /> : null}
            <h1 className="text-3xl font-semibold">{result.name}</h1>
            <p className="text-xl">{formatPrice(result.price, result.currency)}</p>
            {result.description ? <p className="text-muted-foreground">{result.description}</p> : null}
            <Button size="lg" className="w-full" render={<a href={result.buyUrl} rel="noopener" />}>
              Buy now
            </Button>
            <Button variant="ghost" onClick={restart}>
              Start over
            </Button>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">Finding your match…</p>
        )}
      </main>
    </div>
  );
}
