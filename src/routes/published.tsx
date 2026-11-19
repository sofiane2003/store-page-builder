import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDate, messageOf } from "@/client/lib/errors";
import { getPublished, unpublishAny } from "@/serverFunctions/admin";

export const Route = createFileRoute("/published")({
  loader: () => getPublished(),
  head: () => ({ meta: [{ title: "Published · Store Page Builder" }] }),
  component: Published,
});

function Published() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  if (!data.admin) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Published" />
        <div data-testid="admin-only">
          <EmptyState kind="error" title="Admins only" description="Ask an organization admin." />
        </div>
      </AppShell>
    );
  }

  const rows = [
    ...data.pages.map((p) => ({ ...p, what: "page" as const, path: `/s/${p.slug}` })),
    ...data.quizzes.map((q) => ({ ...q, what: "quiz" as const, path: `/q/${q.slug}` })),
  ];

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Published" description="Every member's live pages and quizzes." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing is published" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid="published-row">
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <a href={row.path} target="_blank" rel="noopener" className="text-muted-foreground hover:underline">
                      {row.path}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.updatedAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      pending={pending === row.id}
                      onClick={async () => {
                        setPending(row.id);
                        try {
                          await unpublishAny({ data: { id: row.id, what: row.what } });
                          await router.invalidate();
                        } catch (cause) {
                          toast.error(messageOf(cause));
                        } finally {
                          setPending(null);
                        }
                      }}
                    >
                      Unpublish
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AppShell>
  );
}
