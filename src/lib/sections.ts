import { z } from "zod";

// What a page is made of. Shared by the editor, the AI's validation, the
// public renderer and the Shopify export.

export const PAGE_TYPES = [
  { id: "product", label: "Product page" },
  { id: "landing", label: "Landing page" },
  { id: "listicle", label: "Listicle" },
  { id: "advertorial", label: "Advertorial" },
  { id: "homepage", label: "Homepage" },
  { id: "collection", label: "Collection" },
] as const;
export type PageType = (typeof PAGE_TYPES)[number]["id"];
export const pageTypeIds = PAGE_TYPES.map((t) => t.id) as [PageType, ...PageType[]];
export function pageTypeLabel(id: string): string {
  return PAGE_TYPES.find((t) => t.id === id)?.label ?? id;
}

const short = z.string().trim().max(200);
const long = z.string().trim().max(2000);

type FieldType = "text" | "textarea" | "number" | "datetime";
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
}
export interface KindSpec {
  label: string;
  fields: FieldSpec[];
  list?: { key: string; label: string; fields: FieldSpec[] };
}

export const KINDS = {
  hero: {
    label: "Hero",
    fields: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "subheadline", label: "Supporting line", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
  },
  benefits: {
    label: "Benefits",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    list: { key: "items", label: "Benefit", fields: [{ key: "text", label: "Benefit", type: "text" }] },
  },
  features: {
    label: "Features",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    list: {
      key: "items",
      label: "Feature",
      fields: [
        { key: "title", label: "Feature", type: "text" },
        { key: "text", label: "Detail", type: "textarea" },
      ],
    },
  },
  reviews: {
    label: "Reviews",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    list: {
      key: "items",
      label: "Review",
      fields: [
        { key: "author", label: "Name", type: "text" },
        { key: "rating", label: "Stars", type: "number" },
        { key: "text", label: "Review", type: "textarea" },
      ],
    },
  },
  faq: {
    label: "FAQ",
    fields: [{ key: "heading", label: "Heading", type: "text" }],
    list: {
      key: "items",
      label: "Question",
      fields: [
        { key: "question", label: "Question", type: "text" },
        { key: "answer", label: "Answer", type: "textarea" },
      ],
    },
  },
  comparison: {
    label: "Comparison",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "oursLabel", label: "Our column", type: "text" },
      { key: "theirsLabel", label: "Their column", type: "text" },
    ],
    list: {
      key: "rows",
      label: "Row",
      fields: [
        { key: "feature", label: "Point", type: "text" },
        { key: "ours", label: "Ours", type: "text" },
        { key: "theirs", label: "Theirs", type: "text" },
      ],
    },
  },
  countdown: {
    label: "Countdown",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "endsAt", label: "Ends at", type: "datetime" },
    ],
  },
  image: {
    label: "Image",
    fields: [{ key: "caption", label: "Caption", type: "text" }],
  },
  cta: {
    label: "Call to action",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
  },
  stickyBar: {
    label: "Sticky buy bar",
    fields: [{ key: "buttonLabel", label: "Button label", type: "text" }],
  },
} satisfies Record<string, KindSpec>;

export type SectionKind = keyof typeof KINDS;
export const SECTION_KINDS = Object.keys(KINDS) as [SectionKind, ...SectionKind[]];

const items = <T extends z.ZodRawShape>(shape: T) => z.array(z.object(shape)).max(20).default([]);

/** Each kind's content, without id and kind. */
export const contentSchemas = {
  hero: z.object({ headline: short.default(""), subheadline: long.default(""), buttonLabel: short.default("") }),
  benefits: z.object({ heading: short.default(""), items: items({ text: short }) }),
  features: z.object({ heading: short.default(""), items: items({ title: short, text: long.default("") }) }),
  reviews: z.object({
    heading: short.default(""),
    items: items({ author: short, rating: z.coerce.number().int().min(1).max(5).catch(5), text: long }),
  }),
  faq: z.object({ heading: short.default(""), items: items({ question: short, answer: long }) }),
  comparison: z.object({
    heading: short.default(""),
    oursLabel: short.default(""),
    theirsLabel: short.default(""),
    rows: items({ feature: short, ours: short, theirs: short }),
  }),
  countdown: z.object({
    heading: short.default(""),
    endsAt: z.string().trim().max(40).default(""),
  }),
  image: z.object({ caption: short.default("") }),
  cta: z.object({ heading: short.default(""), text: long.default(""), buttonLabel: short.default("") }),
  stickyBar: z.object({ buttonLabel: short.default("") }),
} satisfies Record<SectionKind, z.ZodTypeAny>;

type Scalar = string | number;
export type SectionContent = Record<string, Scalar | Record<string, Scalar>[]>;
export interface Section {
  id: string;
  kind: SectionKind;
  content: SectionContent;
}

/** A section's content checked against its kind; throws on what doesn't fit. */
export function parseContent(kind: SectionKind, content: unknown): SectionContent {
  return contentSchemas[kind].parse(content) as SectionContent;
}

export const sectionSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(SECTION_KINDS),
  content: z.record(z.string(), z.unknown()),
});

/** Stored sections, each checked against its kind. */
export function parseSections(json: string): Section[] {
  const raw = z.array(sectionSchema).parse(JSON.parse(json));
  return raw.map((s) => ({ ...s, content: parseContent(s.kind, s.content) }));
}

/** An empty section of a kind. */
export function blankContent(kind: SectionKind): SectionContent {
  return parseContent(kind, {});
}

/** True while a countdown's end time is in the future. */
export function countdownRunning(content: SectionContent, now = Date.now()): boolean {
  const ends = Date.parse(String(content["endsAt"] ?? ""));
  return Number.isFinite(ends) && ends > now;
}

export const PRESETS = [
  { id: "clean", label: "Clean" },
  { id: "bold", label: "Bold" },
  { id: "soft", label: "Soft" },
  { id: "fresh", label: "Fresh" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];
export const presetIds = PRESETS.map((p) => p.id) as [PresetId, ...PresetId[]];

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "page"
  );
}
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
  .max(80);
