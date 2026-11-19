import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import type { Product } from "@/server/products";
import { deleteProduct, getProducts, saveProduct, uploadProductImage } from "@/serverFunctions/products";

export const Route = createFileRoute("/products")({
  loader: () => getProducts(),
  head: () => ({ meta: [{ title: "Products · Store Page Builder" }] }),
  component: Products,
});

const PAGE_SIZE = 10;
type SortKey = "name" | "price" | "updated";

function Products() {
  const products = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const value = (p: Product) => (sort.key === "name" ? p.name.toLowerCase() : sort.key === "price" ? p.priceCents : p.updatedAt);
    return [...products].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === "asc" ? order : -order;
    });
  }, [products, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const column = (key: SortKey) => ({
    getIsSorted: () => (sort.key === key ? sort.dir : false),
    getToggleSortingHandler: () => () => {
      setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
      setPage(0);
    },
  });

  async function remove(product: Product) {
    setPending(true);
    setDeleteError(null);
    try {
      await deleteProduct({ data: { id: product.id } });
      setDeleting(null);
      await router.invalidate();
    } catch (cause) {
      setDeleteError(messageOf(cause));
      setDeleting(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Products"
        actions={
          <Button data-testid="new-product" onClick={() => setEditing("new")}>
            New product
          </Button>
        }
      />
      {deleteError ? (
        <Alert variant="destructive" data-testid="form-error">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      ) : null}
      {products.length === 0 ? (
        <EmptyState media="rows" title="No products yet" description="Add one and it will appear here." />
      ) : (
        <div className="space-y-3">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14" />
                  <TableHead>
                    <SortableHeader column={column("name")} label="Name" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader column={column("price")} label="Price" align="right" />
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <SortableHeader column={column("updated")} label="Updated" />
                  </TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((product) => (
                  <TableRow key={product.id} data-testid="product-row">
                    <TableCell>
                      {product.imageKey ? (
                        <img src={`/f/${product.imageKey}`} alt="" className="size-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ImageIcon className="size-4" aria-hidden />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(product.priceCents / 100).toFixed(2)} {product.currency}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{product.updatedAt.slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${product.name}`} onClick={() => setEditing(product)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${product.name}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(product);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          {pages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
              <span>
                Page {current + 1} of {pages}
              </span>
              <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {editing ? (
        <ProductDialog
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </AppShell>
  );
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

function ProductDialog({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [currency, setCurrency] = useState(product?.currency ?? "USD");
  const [description, setDescription] = useState(product?.description ?? "");
  const [buyUrl, setBuyUrl] = useState(product?.buyUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const saved = await saveProduct({ data: { id: product?.id, name, price, currency, description, buyUrl } });
      if (file) {
        await uploadProductImage({ data: { id: saved.id, contentType: file.type, data: await readBase64(file) } });
      }
      onSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      title={product ? "Edit product" : "New product"}
      onClose={onClose}
      actions={
        <Button onClick={save} pending={pending}>
          Save product
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product-name">Name</Label>
          <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-price">Price</Label>
            <Input id="product-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-currency">Currency</Label>
            <Input id="product-currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-description">Description</Label>
          <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-buy">Buy link</Label>
          <Input id="product-buy" type="url" placeholder="https://" value={buyUrl} onChange={(e) => setBuyUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-image">Image</Label>
          <Input
            id="product-image"
            data-testid="product-image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {error ? (
          <Alert variant="destructive" data-testid="form-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </FormDialog>
  );
}

