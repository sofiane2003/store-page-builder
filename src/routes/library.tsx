import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDate, messageOf } from "@/client/lib/errors";
import { KINDS } from "@/lib/sections";
import { deleteSaved, getLibrary } from "@/serverFunctions/library";

export const Route = createFileRoute("/library")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library · Store Page Builder" }] }),
  component: Library,
});

/** A line that says what's in a saved section. */
function summary(content: Record<string, unknown>): string {
  const first = ["heading", "headline", "caption", "buttonLabel"].map((k) => content[k]).find((v) => typeof v === "string" && v);
  const items = Object.values(content).find(Array.isArray);
  return [first, items ? `${items.length} items` : null].filter(Boolean).join(" · ");
}

function Library() {
  const saved = Route.useLoaderData();
  const router = useRouter();
  const [deleting, setDeleting] = useState<(typeof saved)[number] | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Library" />
      {saved.length === 0 ? (
        <EmptyState
          media="rows"
          title="No saved sections yet"
          description="Save a section from any page and it will appear here."
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="hidden sm:table-cell">Content</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {saved.map((item) => (
                <TableRow key={item.id} data-testid="saved-row">
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{KINDS[item.kind].label}</TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground sm:table-cell">{summary(item.content)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteSaved({ data: { id: deleting.id } });
              setDeleting(null);
              await router.invalidate();
            } catch (cause) {
              toast.error(messageOf(cause));
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}
