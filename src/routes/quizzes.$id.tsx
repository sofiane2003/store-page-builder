import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { Choice } from "@/client/components/Choice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { NotFoundState } from "@/client/components/NotFound";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import type { QuizQuestions } from "@/lib/quiz";
import { deleteQuiz, getQuizEditor, saveQuiz, setQuizStatus } from "@/serverFunctions/quizzes";

export const Route = createFileRoute("/quizzes/$id")({
  loader: ({ params }) => getQuizEditor({ data: { id: params.id } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.quiz.title ?? "Quiz"} · Store Page Builder` }] }),
  component: QuizEditor,
});

type Data = NonNullable<Awaited<ReturnType<typeof getQuizEditor>>>;

function QuizEditor() {
  const data = Route.useLoaderData();
  return (
    <AppShell nav={<AppNav />}>
      {data ? <Loaded key={data.quiz.id} data={data} /> : <NotFoundState what="Quiz" back="/quizzes" />}
    </AppShell>
  );
}

function Loaded({ data }: { data: Data }) {
  const { quiz, products, origin } = data;
  const router = useRouter();
  const navigate = useNavigate();
  const [title, setTitle] = useState(quiz.title);
  const [intro, setIntro] = useState(quiz.intro);
  const [slug, setSlug] = useState(quiz.slug);
  const [questions, setQuestions] = useState<QuizQuestions>(quiz.questions);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const published = quiz.status === "published";
  const total = quiz.results.reduce((sum, r) => sum + r.responses, 0);

  async function act(name: string, work: () => Promise<unknown>, done?: string) {
    setPending(name);
    setError(null);
    try {
      await work();
      await router.invalidate();
      if (done) toast.success(done);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(null);
    }
  }

  const updateQuestion = (i: number, change: Partial<QuizQuestions[number]>) =>
    setQuestions(questions.map((q, n) => (n === i ? { ...q, ...change } : q)));

  return (
    <>
      <PageHeader
        backLink={
          <Link to="/quizzes" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Quizzes
          </Link>
        }
        title={quiz.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge data-testid="quiz-status" variant={published ? "default" : "secondary"}>
              {published ? "Published" : "Draft"}
            </Badge>
            {published ? (
              <a href={`${origin}/q/${quiz.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-foreground">
                /q/{quiz.slug}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button
              variant={published ? "outline" : "default"}
              pending={pending === "status"}
              onClick={() => act("status", () => setQuizStatus({ data: { id: quiz.id, status: published ? "draft" : "published" } }))}
            >
              {published ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete quiz
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card data-testid="quiz-results">
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {quiz.results.map((r) => (
                <li key={r.productId} data-testid="result-row" className="flex justify-between py-2">
                  <span>{r.name}</span>
                  <span className="tabular-nums">{r.responses}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-title">Title</Label>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-slug">Slug</Label>
            <Input id="quiz-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiz-intro">Intro</Label>
          <Textarea id="quiz-intro" value={intro} onChange={(e) => setIntro(e.target.value)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Questions</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Answers point to products. <Link to="/products" className="underline">Add a product</Link> first.
          </p>
        ) : null}
        {questions.map((question, qi) => (
          <Card key={question.id} data-testid="quiz-question">
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`${question.id}-text`}>Question</Label>
                  <Input id={`${question.id}-text`} value={question.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} />
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove step" onClick={() => setQuestions(questions.filter((_, n) => n !== qi))}>
                  <X />
                </Button>
              </div>
              {question.answers.map((answer, ai) => {
                const setAnswer = (change: Partial<typeof answer>) =>
                  updateQuestion(qi, { answers: question.answers.map((a, n) => (n === ai ? { ...a, ...change } : a)) });
                return (
                  <div key={answer.id} data-testid="quiz-answer" className="grid items-end gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_12rem_5rem_auto]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${answer.id}-text`}>Answer</Label>
                      <Input id={`${answer.id}-text`} value={answer.text} onChange={(e) => setAnswer({ text: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${answer.id}-product`}>Product</Label>
                      <Choice
                        id={`${answer.id}-product`}
                        testId="answer-product"
                        value={answer.productId}
                        placeholder="Product"
                        items={products.map((p) => ({ value: p.id, label: p.name }))}
                        onChange={(productId) => setAnswer({ productId })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${answer.id}-points`}>Points</Label>
                      <Input id={`${answer.id}-points`} type="number" min={0} max={100} value={answer.points} onChange={(e) => setAnswer({ points: Number(e.target.value) })} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove choice"
                      onClick={() => updateQuestion(qi, { answers: question.answers.filter((_, n) => n !== ai) })}
                    >
                      <X />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuestion(qi, {
                    answers: [...question.answers, { id: crypto.randomUUID(), text: "", productId: products[0]?.id ?? "", points: 1 }],
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Add answer
              </Button>
            </CardContent>
          </Card>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setQuestions([...questions, { id: crypto.randomUUID(), text: "", answers: [] }])}>
            <Plus data-icon="inline-start" />
            Add question
          </Button>
          <Button
            pending={pending === "save"}
            onClick={() => act("save", () => saveQuiz({ data: { id: quiz.id, title, intro, slug, questions } }), "Quiz saved")}
          >
            Save quiz
          </Button>
        </div>
      </section>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this quiz?"
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await deleteQuiz({ data: { id: quiz.id } });
              await navigate({ to: "/quizzes" });
            } catch (cause) {
              toast.error(messageOf(cause));
            }
          }}
        >
          Its responses are deleted too.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
