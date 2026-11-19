import { useEffect, useState } from "react";
import { Check, Star } from "lucide-react";
import { cn } from "cn";
import { countdownRunning, formatPrice, type SectionContent, type SectionKind } from "@/lib/sections";

export interface RenderedProduct {
  name: string;
  priceCents: number;
  currency: string;
  description: string;
  imageUrl: string | null;
  buyUrl: string;
}
export interface RenderedSection {
  id: string;
  kind: SectionKind;
  content: SectionContent;
}

/** Each preset: colours from the theme tokens, a type scale and a button style. */
const PRESET_STYLES: Record<string, { button: string; headline: string; heading: string; band: string; badge: string }> = {
  clean: {
    button: "rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
    headline: "text-4xl font-semibold tracking-tight @2xl:text-5xl",
    heading: "text-2xl font-semibold",
    band: "bg-muted",
    badge: "text-primary",
  },
  bold: {
    button: "rounded-none bg-foreground text-background font-bold uppercase tracking-wider hover:bg-foreground/90",
    headline: "text-5xl font-extrabold uppercase tracking-tight @2xl:text-6xl",
    heading: "text-3xl font-extrabold uppercase",
    band: "bg-foreground text-background",
    badge: "text-warning",
  },
  soft: {
    button: "rounded-full bg-accent text-accent-foreground hover:bg-accent/80",
    headline: "text-3xl font-medium @2xl:text-4xl",
    heading: "text-xl font-medium",
    band: "bg-secondary",
    badge: "text-info",
  },
  fresh: {
    button: "rounded-lg bg-success text-success-foreground font-semibold hover:bg-success/90",
    headline: "text-4xl font-bold @2xl:text-5xl",
    heading: "text-2xl font-bold",
    band: "bg-success/10",
    badge: "text-success",
  },
};

const list = (content: SectionContent, key: string) =>
  (Array.isArray(content[key]) ? content[key] : []) as Record<string, string | number>[];

/** A store page's sections, mobile first. Used by the editor's preview and the public page. */
export function PageRenderer({
  sections,
  product,
  preset,
  mode,
}: {
  sections: RenderedSection[];
  product: RenderedProduct;
  preset: string;
  mode: "public" | "preview";
}) {
  const style = PRESET_STYLES[preset] ?? PRESET_STYLES.clean!;
  const price = formatPrice(product.priceCents, product.currency);
  const buy = (label: unknown, className?: string) => (
    <a
      data-testid="buy-button"
      href={product.buyUrl}
      rel="noopener"
      className={cn("inline-flex min-h-11 items-center justify-center px-6 text-base transition-colors", style.button, className)}
    >
      {String(label || "Buy now")}
    </a>
  );
  const sticky = sections.find((s) => s.kind === "stickyBar");

  return (
    <div className={cn("@container bg-background text-foreground", sticky && "pb-24")}>
      {sections.map(({ id, kind, content: c }) => {
        switch (kind) {
          case "hero":
            return (
              <section key={id} className="mx-auto grid max-w-5xl gap-8 px-5 py-12 @2xl:grid-cols-2 @2xl:items-center">
                <div className="space-y-4">
                  <h1 className={style.headline}>{String(c.headline || product.name)}</h1>
                  {c.subheadline ? <p className="text-lg text-muted-foreground">{String(c.subheadline)}</p> : null}
                  <p className="text-xl font-semibold">{price}</p>
                  {buy(c.buttonLabel, "w-full @2xl:w-auto")}
                </div>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="aspect-square w-full rounded-xl object-cover" />
                ) : null}
              </section>
            );
          case "benefits":
            return (
              <section key={id} className={cn("px-5 py-10", style.band)}>
                <div className="mx-auto max-w-3xl space-y-5">
                  {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                  <ul className="space-y-3">
                    {list(c, "items").map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-lg">
                        <Check className={cn("mt-1 size-5 shrink-0", style.badge)} aria-hidden />
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          case "features":
            return (
              <section key={id} className="mx-auto max-w-5xl space-y-6 px-5 py-10">
                {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                <div className="grid gap-6 @2xl:grid-cols-3">
                  {list(c, "items").map((item, i) => (
                    <div key={i} className="space-y-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case "reviews":
            return (
              <section key={id} className="mx-auto max-w-5xl space-y-6 px-5 py-10">
                {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                <div className="grid gap-4 @2xl:grid-cols-2">
                  {list(c, "items").map((item, i) => (
                    <figure key={i} className="space-y-2 rounded-xl border border-border bg-card p-5">
                      <div className={cn("flex gap-0.5", style.badge)} aria-label={`${item.rating} out of 5`}>
                        {Array.from({ length: Number(item.rating) || 5 }, (_, n) => (
                          <Star key={n} className="size-4 fill-current" aria-hidden />
                        ))}
                      </div>
                      <blockquote>{item.text}</blockquote>
                      <figcaption className="text-sm text-muted-foreground">{item.author}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            );
          case "faq":
            return (
              <section key={id} className="mx-auto max-w-3xl space-y-4 px-5 py-10">
                {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                <div className="divide-y divide-border rounded-xl border border-border">
                  {list(c, "items").map((item, i) => (
                    <details key={i} className="group px-5 py-4" open={i === 0}>
                      <summary className="cursor-pointer font-medium">{item.question}</summary>
                      <p className="pt-2 text-muted-foreground">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          case "comparison":
            return (
              <section key={id} className="mx-auto max-w-3xl space-y-4 px-5 py-10">
                {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                <table className="w-full text-left text-sm @2xl:text-base">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2" />
                      <th className="py-2 font-semibold">{String(c.oursLabel || product.name)}</th>
                      <th className="py-2 font-semibold text-muted-foreground">{String(c.theirsLabel || "Others")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list(c, "rows").map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="py-2 pr-2">{row.feature}</td>
                        <td className="py-2 pr-2 font-medium">{row.ours}</td>
                        <td className="py-2 text-muted-foreground">{row.theirs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          case "countdown":
            return <Countdown key={id} heading={String(c.heading ?? "")} endsAt={String(c.endsAt ?? "")} band={style.band} />;
          case "image":
            return product.imageUrl ? (
              <figure key={id} className="mx-auto max-w-3xl space-y-2 px-5 py-8">
                <img src={product.imageUrl} alt={product.name} className="w-full rounded-xl object-cover" />
                {c.caption ? <figcaption className="text-center text-sm text-muted-foreground">{String(c.caption)}</figcaption> : null}
              </figure>
            ) : null;
          case "cta":
            return (
              <section key={id} className={cn("px-5 py-12 text-center", style.band)}>
                <div className="mx-auto max-w-2xl space-y-4">
                  {c.heading ? <h2 className={style.heading}>{String(c.heading)}</h2> : null}
                  {c.text ? <p className="text-lg">{String(c.text)}</p> : null}
                  {buy(c.buttonLabel)}
                </div>
              </section>
            );
          case "stickyBar":
            return null;
        }
      })}
      {sticky ? (
        <div
          data-testid="sticky-bar"
          className={cn(
            "inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur",
            mode === "public" ? "fixed" : "sticky",
          )}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">{price}</p>
            </div>
            {buy(sticky.content.buttonLabel, "shrink-0")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function remaining(endsAt: string): string | null {
  const ms = Date.parse(endsAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const parts = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  return `${parts[0]}d ${String(parts[1]).padStart(2, "0")}h ${String(parts[2]).padStart(2, "0")}m ${String(parts[3]).padStart(2, "0")}s`;
}

/** Disappears when its end time passes. */
function Countdown({ heading, endsAt, band }: { heading: string; endsAt: string; band: string }) {
  const [left, setLeft] = useState<string | null>(() => (countdownRunning({ endsAt }) ? "" : null));
  useEffect(() => {
    const tick = () => setLeft(remaining(endsAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (left === null) return null;
  return (
    <section data-testid="countdown" className={cn("px-5 py-6 text-center", band)}>
      {heading ? <p className="font-semibold">{heading}</p> : null}
      <p className="font-mono text-2xl tabular-nums" suppressHydrationWarning>
        {left}
      </p>
    </section>
  );
}
