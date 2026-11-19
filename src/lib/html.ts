import { formatPrice, type SectionContent } from "@/lib/sections";
import type { PublicPage } from "@/server/pages";

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const list = (content: SectionContent, key: string) =>
  (Array.isArray(content[key]) ? content[key] : []) as Record<string, unknown>[];

/** The page as plain HTML for a store's own theme to style (the Shopify push). */
export function renderPageHtml(page: PublicPage, origin: string): string {
  const { product } = page;
  const buy = (label: unknown) => `<p><a href="${esc(product.buyUrl)}">${esc(label || "Buy now")}</a></p>`;
  return page.sections
    .map(({ kind, content: c }) => {
      switch (kind) {
        case "hero":
          return `<h2>${esc(c.headline)}</h2><p>${esc(c.subheadline)}</p>${buy(c.buttonLabel)}`;
        case "benefits":
          return `<h3>${esc(c.heading)}</h3><ul>${list(c, "items").map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul>`;
        case "features":
          return `<h3>${esc(c.heading)}</h3>${list(c, "items").map((i) => `<p><strong>${esc(i.title)}</strong> ${esc(i.text)}</p>`).join("")}`;
        case "reviews":
          return `<h3>${esc(c.heading)}</h3>${list(c, "items").map((i) => `<blockquote><p>${"★".repeat(Number(i.rating) || 5)} ${esc(i.text)}</p><p>${esc(i.author)}</p></blockquote>`).join("")}`;
        case "faq":
          return `<h3>${esc(c.heading)}</h3>${list(c, "items").map((i) => `<details><summary>${esc(i.question)}</summary><p>${esc(i.answer)}</p></details>`).join("")}`;
        case "comparison":
          return `<h3>${esc(c.heading)}</h3><table><tr><th></th><th>${esc(c.oursLabel)}</th><th>${esc(c.theirsLabel)}</th></tr>${list(c, "rows").map((r) => `<tr><td>${esc(r.feature)}</td><td>${esc(r.ours)}</td><td>${esc(r.theirs)}</td></tr>`).join("")}</table>`;
        case "countdown":
          return `<p><strong>${esc(c.heading)}</strong></p>`;
        case "image":
          return product.imageUrl ? `<figure><img src="${esc(origin + product.imageUrl)}" alt="${esc(product.name)}"><figcaption>${esc(c.caption)}</figcaption></figure>` : "";
        case "cta":
          return `<h3>${esc(c.heading)}</h3><p>${esc(c.text)}</p>${buy(c.buttonLabel)}`;
        case "stickyBar":
          return `<p>${esc(product.name)} · ${esc(formatPrice(product.priceCents, product.currency))}</p>${buy(c.buttonLabel)}`;
      }
    })
    .join("\n");
}
