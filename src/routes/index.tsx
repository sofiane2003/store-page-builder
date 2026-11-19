import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDate, messageOf } from "@/client/lib/errors";
import { PAGE_TYPES, pageTypeLabel, type PageType } from "@/lib/sections";
import { createBlankPage, generatePage, getPages } from "@/serverFunctions/pages";

export const Route = createFileRoute("/")({
  loader: () => getPages(),
  head: () => ({ meta: [{ title: "Pages · Store Page Builder" }] }),
  component: PagesList,
});

function PagesList() {
  const { pages, products, language } = Route.useLoaderData();
  const [creating, setCreating] = useState(false);
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Pages"
        actions={
          <Button data-testid="new-page" onClick={() => setCreating(true)} disabled={products.length === 0}>
            New page
          </Button>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="Add a product first"
          description="Every page sells one of your products."
          action={<Button render={<Link to="/products" />}>Add a product</Button>}
        />
      ) : pages.length === 0 ? (
        <EmptyState media="rows" title="No pages yet" description="Create one and it will appear here." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id} data-testid="page-row">
                  <TableCell className="font-medium">
                    <Link to="/pages/$id" params={{ id: page.id }} className="hover:underline">
                      {page.title}
                    </Link>
                  </TableCell>
                  <TableCell>{pageTypeLabel(page.type)}</TableCell>
                  <TableCell>{page.productName}</TableCell>
                  <TableCell>
                    <Badge variant={page.status === "published" ? "default" : "secondary"}>
                      {page.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(page.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {creating ? <NewPageDialog products={products} language={language} onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

function NewPageDialog({
  products,
  language: defaultLanguage,
  onClose,
}: {
  products: { id: string; name: string }[];
  language: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [type, setType] = useState<PageType>("product");
  const [language, setLanguage] = useState(defaultLanguage);
  const [angle, setAngle] = useState("");
  const [pending, setPending] = useState<"blank" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiOff, setAiOff] = useState<string | null>(null);

  async function create(withAi: boolean) {
    setError(null);
    setPending(withAi ? "ai" : "blank");
    const data = { title, productId, type, language, angle };
    try {
      if (withAi) {
        const result = await generatePage({ data });
        if (!result.ok) {
          if (result.aiOff) setAiOff(result.setup);
          else setError(result.error);
          return;
        }
        await navigate({ to: "/pages/$id", params: { id: result.id } });
      } else {
        const { id } = await createBlankPage({ data });
        await navigate({ to: "/pages/$id", params: { id } });
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(null);
    }
  }

  return (
    <FormDialog
      title="New page"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={() => create(false)} pending={pending === "blank"} disabled={pending !== null}>
            Create blank page
          </Button>
          <Button onClick={() => create(true)} pending={pending === "ai"} disabled={pending !== null || aiOff !== null}>
            Write with AI
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="page-title">Title</Label>
          <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="page-product">Product</Label>
            <Choice
              id="page-product"
              testId="page-product"
              value={productId}
              items={products.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setProductId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-type">Type</Label>
            <Choice
              id="page-type"
              testId="page-type"
              value={type}
              items={PAGE_TYPES.map((t) => ({ value: t.id, label: t.label }))}
              onChange={(v) => setType(v as PageType)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="page-language">Language</Label>
          <Input id="page-language" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="page-angle">Angle and audience</Label>
          <Textarea
            id="page-angle"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="Who it's for and why they'd buy"
          />
        </div>
        {aiOff ? (
          <Alert data-testid="ai-off">
            <AlertDescription>{aiOff}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="form-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </FormDialog>
  );
}
