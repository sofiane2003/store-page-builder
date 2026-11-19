import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { Choice } from "@/client/components/Choice";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { PRESETS, type PresetId } from "@/lib/sections";
import { getBrand, saveBrand } from "@/serverFunctions/brand";

export const Route = createFileRoute("/brand")({
  loader: () => getBrand(),
  head: () => ({ meta: [{ title: "Brand · Store Page Builder" }] }),
  component: Brand,
});

function Brand() {
  const brand = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState(brand);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  async function save() {
    setPending(true);
    setError(null);
    try {
      await saveBrand({ data: form });
      await router.invalidate();
      toast.success("Brand saved");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Brand" />
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input id="brand-name" value={form.brandName} onChange={(e) => set("brandName")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-voice">Voice notes</Label>
            <Textarea
              id="brand-voice"
              value={form.voice}
              placeholder="Warm and plain-spoken, no exclamation marks"
              onChange={(e) => set("voice")(e.target.value)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brand-language">Default language</Label>
              <Input id="brand-language" value={form.language} onChange={(e) => set("language")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-preset">Style preset</Label>
              <Choice
                id="brand-preset"
                testId="brand-preset"
                value={form.preset}
                items={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(v) => setForm({ ...form, preset: v as PresetId })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-shopify">Shopify store</Label>
            <Input
              id="brand-shopify"
              value={form.shopifyStore}
              placeholder="your-store.myshopify.com"
              onChange={(e) => set("shopifyStore")(e.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive" data-testid="form-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button pending={pending} onClick={save}>
            Save brand
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
