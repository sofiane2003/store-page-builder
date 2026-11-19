import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDate, messageOf } from "@/client/lib/errors";
import { createQuiz, getQuizzes } from "@/serverFunctions/quizzes";

export const Route = createFileRoute("/quizzes/")({
  loader: () => getQuizzes(),
  head: () => ({ meta: [{ title: "Quizzes · Store Page Builder" }] }),
  component: Quizzes,
});

function Quizzes() {
  const quizzes = Route.useLoaderData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      const { id } = await createQuiz({ data: { title } });
      await navigate({ to: "/quizzes/$id", params: { id } });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Quizzes" actions={<Button data-testid="new-quiz" onClick={() => setCreating(true)}>New quiz</Button>} />
      {quizzes.length === 0 ? (
        <EmptyState media="rows" title="No quizzes yet" description="Create one and it will appear here." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Responses</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((quiz) => (
                <TableRow key={quiz.id} data-testid="quiz-row">
                  <TableCell className="font-medium">
                    <Link to="/quizzes/$id" params={{ id: quiz.id }} className="hover:underline">
                      {quiz.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={quiz.status === "published" ? "default" : "secondary"}>
                      {quiz.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{quiz.responses}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(quiz.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {creating ? (
        <FormDialog
          title="New quiz"
          onClose={() => setCreating(false)}
          actions={
            <Button pending={pending} onClick={create}>
              Create quiz
            </Button>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Title</Label>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </FormDialog>
      ) : null}
    </AppShell>
  );
}
