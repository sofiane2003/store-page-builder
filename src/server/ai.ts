import { env } from "cloudflare:workers";
import { aiBaseUrl, createGatewayFetch, gatewayRefusal, refusalFromError } from "@every-app/sdk/server";
import { z } from "zod";
import type { Brand } from "@/server/brand";
import type { Product } from "@/server/products";
import { formatPrice, KINDS, parseContent, pageTypeLabel, SECTION_KINDS, type Section, type SectionKind } from "@/lib/sections";

// The model the app asks OpenRouter for, through the Gateway (everyapp.config.ts).
export const AI_PROVIDER = "openrouter";
export const AI_MODEL = "google/gemini-2.5-flash";

const OFF = "No AI provider is set up. An admin can add one in the Gateway.";

export type AiResult<T> = { ok: true; value: T } | { ok: false; aiOff: true; setup: string } | { ok: false; aiOff: false; error: string };

function describeKinds(): string {
  return SECTION_KINDS.map((kind) => {
    const spec = KINDS[kind] as (typeof KINDS)[SectionKind] & { list?: { key: string; fields: { key: string }[] } };
    const fields = spec.fields.map((f) => `"${f.key}": string`);
    if (spec.list) fields.push(`"${spec.list.key}": [{ ${spec.list.fields.map((f) => `"${f.key}"`).join(", ")} }]`);
    return `- "${kind}" (${spec.label}): { ${fields.join(", ")} }`;
  }).join("\n");
}

function context(brand: Brand, product: Product, language: string): string {
  return [
    `Write in ${language}.`,
    brand.brandName ? `Brand: ${brand.brandName}.` : "",
    brand.voice ? `Brand voice: ${brand.voice}` : "",
    `Product: ${product.name}, ${formatPrice(product.priceCents, product.currency)}.`,
    product.description ? `About the product: ${product.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function complete(messages: { role: "system" | "user"; content: string }[]): Promise<unknown> {
  const gatewayFetch = createGatewayFetch({ env });
  const response = await gatewayFetch(`${aiBaseUrl(AI_PROVIDER)}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, messages, response_format: { type: "json_object" } }),
  });
  if (!response.ok) {
    const refusal = await gatewayRefusal(response);
    throw refusal ? new AiOff(refusal.code, refusal.setup) : new Error(`model call failed (${response.status})`);
  }
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON in the answer");
  return JSON.parse(text.slice(start, end + 1));
}

const rawSection = z.object({ kind: z.enum(SECTION_KINDS) }).passthrough();

function toSection(raw: unknown, id: string): Section {
  const { kind, ...content } = rawSection.parse(raw);
  return { id, kind, content: parseContent(kind, content) };
}

class AiOff extends Error {
  constructor(
    readonly code: string,
    readonly setup: string | null,
  ) {
    super(code);
  }
}

async function guarded<T>(work: () => Promise<T>): Promise<AiResult<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    const refusal = error instanceof AiOff ? error : refusalFromError(error);
    if (refusal) return { ok: false, aiOff: true, setup: refusal.setup ?? OFF };
    if (error instanceof Error && /not_configured|unavailable/.test(error.message)) {
      return { ok: false, aiOff: true, setup: OFF };
    }
    return { ok: false, aiOff: false, error: "The AI's answer didn't fit. Nothing changed; try again." };
  }
}

export function generateSections(input: {
  brand: Brand;
  product: Product;
  type: string;
  language: string;
  angle: string;
}): Promise<AiResult<Section[]>> {
  return guarded(async () => {
    const json = await complete([
      {
        role: "system",
        content: `You write high-converting store pages. Answer with JSON only: { "sections": [ ... ] }, 5 to 9 sections, each an object with "kind" and that kind's fields:\n${describeKinds()}\nStart with a hero, end with a stickyBar. Use the kinds that suit a ${pageTypeLabel(input.type)}. Reviews have rating 1-5. Leave countdown out unless asked.`,
      },
      {
        role: "user",
        content: `${context(input.brand, input.product, input.language)}\nPage type: ${pageTypeLabel(input.type)}.\nAngle and audience: ${input.angle || "General shoppers."}`,
      },
    ]);
    const sections = z.object({ sections: z.array(z.unknown()).min(1).max(20) }).parse(json).sections;
    return sections.map((raw) => toSection(raw, crypto.randomUUID()));
  });
}

export function reviseSection(input: {
  brand: Brand;
  product: Product;
  language: string;
  section: Section;
  history: { role: string; text: string }[];
  instruction: string;
}): Promise<AiResult<Section>> {
  return guarded(async () => {
    const json = await complete([
      {
        role: "system",
        content: `You rewrite one section of a store page. Answer with JSON only: { "section": { "kind": "${input.section.kind}", ...fields } } keeping the same kind. The kinds and their fields:\n${describeKinds()}`,
      },
      {
        role: "user",
        content: `${context(input.brand, input.product, input.language)}\nEarlier instructions for this section: ${
          input.history.filter((m) => m.role === "user").map((m) => m.text).join(" / ") || "none"
        }\nThe section now: ${JSON.stringify({ kind: input.section.kind, ...input.section.content })}\nInstruction: ${input.instruction}`,
      },
    ]);
    const section = toSection(z.object({ section: z.unknown() }).parse(json).section, input.section.id);
    if (section.kind !== input.section.kind) throw new Error("kind changed");
    return section;
  });
}
