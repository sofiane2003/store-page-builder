import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronLeft, ExternalLink, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { Choice } from "@/client/components/Choice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { NotFoundState } from "@/client/components/NotFound";
import { PageHeader } from "@/client/components/PageHeader";
import { PageRenderer } from "@/client/components/PageRenderer";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import {
  KINDS,
  PAGE_TYPES,
  PRESETS,
  SECTION_KINDS,
  type FieldSpec,
  type KindSpec,
  type Section,
  type SectionContent,
  type SectionKind,
} from "@/lib/sections";
import { saveToLibrary } from "@/serverFunctions/library";
import {
  addSection,
  askAi,
  deletePage,
  deleteSection,
  getPageEditor,
  insertSaved,
  moveSection,
  pushToShopify,
  saveSection,
  setPageStatus,
  updatePageSettings,
} from "@/serverFunctions/pages";

export const Route = createFileRoute("/pages/$id")({
  loader: ({ params }) => getPageEditor({ data: { id: params.id } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.page.title ?? "Page"} · Store Page Builder` }] }),
  component: Editor,
});

type EditorData = NonNullable<Awaited<ReturnType<typeof getPageEditor>>>;

function backLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      Pages
    </Link>
  );
}

/** Runs a change, then reloads the page's data; failures become a toast. */
function useChange() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  async function run(name: string, work: () => Promise<unknown>, done?: string) {
    setPending(name);
    try {
      await work();
      await router.invalidate();
      if (done) toast.success(done);
      return true;
    } catch (cause) {
      toast.error(messageOf(cause));
      return false;
    } finally {
      setPending(null);
    }
  }
  return { run, pending };
}

function Editor() {
  const data = Route.useLoaderData();
  if (!data) {
    return (
      <AppShell nav={<AppNav />}>
        <NotFoundState what="Page" back="/" />
      </AppShell>
    );
  }
  return <EditorLoaded data={data} />;
}

function EditorLoaded({ data }: { data: EditorData }) {
  const { page, products, origin } = data;
  const navigate = useNavigate();
  const { run, pending } = useChange();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  const product = products.find((p) => p.id === page.productId);
  const published = page.status === "published";
  const publicUrl = `${origin}/s/${page.slug}`;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        backLink={backLink()}
        title={page.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge data-testid="page-status" variant={published ? "default" : "secondary"}>
              {published ? "Published" : "Draft"}
            </Badge>
            {published ? (
              <a data-testid="public-link" href={publicUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-foreground">
                /s/{page.slug}
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
              onClick={() =>
                run("status", () => setPageStatus({ data: { id: page.id, status: published ? "draft" : "published" } }))
              }
            >
              {published ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete page
            </Button>
          </>
        }
      />

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="space-y-8 pt-4">
          <Sections data={data} />
          <Settings data={data} />
          <Shopify data={data} />
        </TabsContent>
        <TabsContent value="preview" className="space-y-4 pt-4">
          <div className="flex gap-2">
            {(["desktop", "phone"] as const).map((w) => (
              <Button key={w} size="sm" variant={width === w ? "default" : "outline"} aria-pressed={width === w} onClick={() => setWidth(w)}>
                {w === "desktop" ? "Desktop" : "Phone"}
              </Button>
            ))}
          </div>
          <div
            data-testid="page-preview"
            data-width={width}
            className={
              width === "phone"
                ? "mx-auto h-[720px] w-[390px] max-w-full overflow-y-auto rounded-2xl border border-border"
                : "h-[720px] overflow-y-auto rounded-lg border border-border"
            }
          >
            {product ? (
              <PageRenderer
                mode="preview"
                preset={page.preset}
                sections={page.sections}
                product={{ ...product, imageUrl: product.imageKey ? `/f/${product.imageKey}` : null }}
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this page?"
          confirmLabel="Delete"
          destructive
          pending={pending === "delete"}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await deletePage({ data: { id: page.id } });
              await navigate({ to: "/" });
            } catch (cause) {
              toast.error(messageOf(cause));
            }
          }}
        >
          {published ? "Its public link stops working." : null}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function Sections({ data }: { data: EditorData }) {
  const { page, saved } = data;
  const { run, pending } = useChange();
  const [kind, setKind] = useState<SectionKind>("hero");
  const [savedId, setSavedId] = useState("");
  const [askingFor, setAskingFor] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Sections</h2>
      {page.sections.length === 0 ? (
        <EmptyState size="sm" title="No sections yet" description="Add one below." />
      ) : (
        page.sections.map((section, index) => (
          <SectionCard
            key={`${section.id}:${JSON.stringify(section.content)}`}
            pageId={page.id}
            section={section}
            first={index === 0}
            last={index === page.sections.length - 1}
            asking={askingFor === section.id}
            onAsk={(open) => setAskingFor(open ? section.id : null)}
            messages={page.messages.filter((m) => m.sectionId === section.id)}
          />
        ))
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Choice
            testId="add-section-kind"
            value={kind}
            items={SECTION_KINDS.map((k) => ({ value: k, label: KINDS[k].label }))}
            onChange={(v) => setKind(v as SectionKind)}
          />
        </div>
        <Button
          variant="outline"
          pending={pending === "add"}
          onClick={() => run("add", () => addSection({ data: { pageId: page.id, kind } }))}
        >
          <Plus data-icon="inline-start" />
          Add section
        </Button>
        {saved.length > 0 ? (
          <>
            <div className="w-48">
              <Choice
                testId="library-pick"
                value={savedId}
                placeholder="From library"
                items={saved.map((s) => ({ value: s.id, label: s.name }))}
                onChange={setSavedId}
              />
            </div>
            <Button
              variant="outline"
              disabled={!savedId}
              pending={pending === "insert"}
              onClick={() => run("insert", () => insertSaved({ data: { pageId: page.id, savedId } }))}
            >
              Insert
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SectionCard({
  pageId,
  section,
  first,
  last,
  asking,
  onAsk,
  messages,
}: {
  pageId: string;
  section: Section;
  first: boolean;
  last: boolean;
  asking: boolean;
  onAsk: (open: boolean) => void;
  messages: { id: string; role: string; text: string }[];
}) {
  const spec: KindSpec = KINDS[section.kind];
  const [content, setContent] = useState<SectionContent>(section.content);
  const [confirm, setConfirm] = useState(false);
  const [naming, setNaming] = useState(false);
  const { run, pending } = useChange();
  const ref = { pageId, sectionId: section.id };

  return (
    <Card data-testid="section-card" data-section-kind={section.kind}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle data-kind={section.kind}>{spec.label}</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Ask AI" aria-pressed={asking} onClick={() => onAsk(!asking)}>
            <Sparkles />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Save to library" onClick={() => setNaming(true)}>
            <BookmarkPlus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={first} onClick={() => run("move", () => moveSection({ data: { ...ref, direction: "up" } }))}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={last} onClick={() => run("move", () => moveSection({ data: { ...ref, direction: "down" } }))}>
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {asking ? <AskAi pageId={pageId} sectionId={section.id} messages={messages} /> : null}
        {spec.fields.map((field) => (
          <FieldInput
            key={field.key}
            id={`${section.id}-${field.key}`}
            field={field}
            label={field.label}
            value={content[field.key]}
            onChange={(value) => setContent({ ...content, [field.key]: value })}
          />
        ))}
        {spec.list ? <ListEditor spec={spec.list} sectionId={section.id} content={content} setContent={setContent} /> : null}
        <Button
          size="sm"
          pending={pending === "save"}
          onClick={() => run("save", () => saveSection({ data: { ...ref, content } }), "Section saved")}
        >
          Save section
        </Button>
      </CardContent>
      {confirm ? (
        <ConfirmDialog
          title={`Delete this ${spec.label.toLowerCase()} section?`}
          confirmLabel="Delete"
          destructive
          pending={pending === "delete"}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await run("delete", () => deleteSection({ data: ref }));
            setConfirm(false);
          }}
        />
      ) : null}
      {naming ? <SaveToLibrary pageId={pageId} sectionId={section.id} defaultName={spec.label} onClose={() => setNaming(false)} /> : null}
    </Card>
  );
}

function FieldInput({
  id,
  field,
  label,
  value,
  onChange,
}: {
  id: string;
  field: FieldSpec;
  label: string;
  value: unknown;
  onChange: (value: string | number) => void;
}) {
  const text = value === undefined || value === null ? "" : String(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {field.type === "textarea" ? (
        <Textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={field.type === "datetime" ? "datetime-local" : field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? 1 : undefined}
          max={field.type === "number" ? 5 : undefined}
          value={text}
          onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  );
}

function ListEditor({
  spec,
  sectionId,
  content,
  setContent,
}: {
  spec: NonNullable<KindSpec["list"]>;
  sectionId: string;
  content: SectionContent;
  setContent: (content: SectionContent) => void;
}) {
  const items = (Array.isArray(content[spec.key]) ? content[spec.key] : []) as Record<string, string | number>[];
  const setItems = (next: Record<string, string | number>[]) => setContent({ ...content, [spec.key]: next });
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative space-y-3 rounded-lg border border-border p-3 pr-10">
          {spec.fields.map((field) => (
            <FieldInput
              key={field.key}
              id={`${sectionId}-${spec.key}-${i}-${field.key}`}
              field={field}
              label={`${field.label} ${i + 1}`}
              value={item[field.key]}
              onChange={(value) => setItems(items.map((it, n) => (n === i ? { ...it, [field.key]: value } : it)))}
            />
          ))}
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            aria-label={`Remove ${spec.label.toLowerCase()} ${i + 1}`}
            onClick={() => setItems(items.filter((_, n) => n !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setItems([...items, Object.fromEntries(spec.fields.map((f) => [f.key, f.type === "number" ? 5 : ""]))])
        }
      >
        <Plus data-icon="inline-start" />
        Add {spec.label.toLowerCase()}
      </Button>
    </div>
  );
}

function AskAi({ pageId, sectionId, messages }: { pageId: string; sectionId: string; messages: { id: string; role: string; text: string }[] }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [off, setOff] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setPending(true);
    setError(null);
    try {
      const result = await askAi({ data: { pageId, sectionId, instruction } });
      if (!result.ok) {
        if (result.aiOff) setOff(result.setup);
        else setError(result.error);
        return;
      }
      await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted p-3">
      {messages.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {messages.map((m) => (
            <li key={m.id} data-testid="ai-message" className={m.role === "user" ? "font-medium" : "text-muted-foreground"}>
              {m.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${sectionId}-instruction`}>Instruction</Label>
        <Textarea
          id={`${sectionId}-instruction`}
          className="bg-card"
          value={instruction}
          placeholder="Shorter headline, add two more questions…"
          onChange={(e) => setInstruction(e.target.value)}
        />
      </div>
      {off ? (
        <Alert data-testid="ai-off">
          <AlertDescription>{off}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button size="sm" pending={pending} disabled={!instruction.trim() || off !== null} onClick={send}>
        Rewrite section
      </Button>
    </div>
  );
}

function SaveToLibrary({ pageId, sectionId, defaultName, onClose }: { pageId: string; sectionId: string; defaultName: string; onClose: () => void }) {
  const { run, pending } = useChange();
  const [name, setName] = useState(defaultName);
  return (
    <FormDialog
      title="Save to library"
      onClose={onClose}
      actions={
        <Button
          pending={pending === "library"}
          onClick={async () => {
            if (await run("library", () => saveToLibrary({ data: { pageId, sectionId, name } }), "Saved to library")) onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="library-name">Name</Label>
        <Input id="library-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </FormDialog>
  );
}

function Settings({ data }: { data: EditorData }) {
  const { page, products } = data;
  const { run, pending } = useChange();
  const [form, setForm] = useState({
    title: page.title,
    slug: page.slug,
    language: page.language,
    preset: page.preset,
    productId: page.productId,
    type: page.type,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  async function save() {
    setError(null);
    try {
      await updatePageSettings({ data: { id: page.id, ...form } });
    } catch (cause) {
      setError(messageOf(cause));
      return;
    }
    await run("settings", async () => {}, "Settings saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-title">Title</Label>
          <Input id="settings-title" value={form.title} onChange={(e) => set("title")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-slug">Slug</Label>
          <Input id="settings-slug" value={form.slug} onChange={(e) => set("slug")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-language">Language</Label>
          <Input id="settings-language" value={form.language} onChange={(e) => set("language")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-preset">Style preset</Label>
          <Choice id="settings-preset" testId="page-preset" value={form.preset} items={PRESETS.map((p) => ({ value: p.id, label: p.label }))} onChange={set("preset")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-product">Product</Label>
          <Choice id="settings-product" testId="settings-product" value={form.productId} items={products.map((p) => ({ value: p.id, label: p.name }))} onChange={set("productId")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-type">Type</Label>
          <Choice id="settings-type" testId="settings-type" value={form.type} items={PAGE_TYPES.map((t) => ({ value: t.id, label: t.label }))} onChange={set("type")} />
        </div>
        {error ? (
          <Alert variant="destructive" data-testid="form-error" className="sm:col-span-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="sm:col-span-2">
          <Button pending={pending === "settings"} onClick={save}>
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Shopify({ data }: { data: EditorData }) {
  const { page, shopify } = data;
  const { run, pending } = useChange();
  const onShopify = Boolean(page.shopifyPageId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!shopify.ready ? (
          <p data-testid="shopify-off" className="text-muted-foreground">
            Shopify isn't connected. An admin can add a Shopify key in the Gateway.
          </p>
        ) : !shopify.store ? (
          <p className="text-muted-foreground">
            Add your store's address in <Link to="/brand" className="underline">Brand</Link> to push pages to it.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span data-testid="shopify-status" className="text-muted-foreground">
              {onShopify ? `On Shopify at ${shopify.store}` : `Not on ${shopify.store} yet`}
            </span>
            <Button
              variant="outline"
              pending={pending === "shopify"}
              onClick={() =>
                run("shopify", () => pushToShopify({ data: { id: page.id } }), onShopify ? "Updated on Shopify" : "Pushed to Shopify")
              }
            >
              {onShopify ? "Update on Shopify" : "Push to Shopify"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
