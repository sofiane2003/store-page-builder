import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedSections } from "@/db/schema";
import { UserError } from "@/server/errors";
import { pageForAi } from "@/server/pages";
import { parseContent, SECTION_KINDS } from "@/lib/sections";

export const saveToLibraryInput = z.object({
  pageId: z.string().uuid(),
  sectionId: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Name is required").max(120),
});

export async function listSaved(ownerId: string) {
  const rows = await db
    .select()
    .from(savedSections)
    .where(eq(savedSections.ownerId, ownerId))
    .orderBy(desc(savedSections.createdAt));
  return rows.map((r) => {
    const kind = z.enum(SECTION_KINDS).parse(r.kind);
    return { id: r.id, name: r.name, kind, createdAt: r.createdAt, content: parseContent(kind, JSON.parse(r.content)) };
  });
}

/** Saves a copy of a section; later edits to either don't touch the other. */
export async function saveToLibrary(ownerId: string, input: z.infer<typeof saveToLibraryInput>) {
  const { sections } = await pageForAi(ownerId, input.pageId);
  const section = sections.find((s) => s.id === input.sectionId);
  if (!section) throw new UserError("Section not found");
  await db.insert(savedSections).values({
    id: crypto.randomUUID(),
    ownerId,
    name: input.name,
    kind: section.kind,
    content: JSON.stringify(section.content),
    createdAt: new Date().toISOString(),
  });
}

export async function deleteSaved(ownerId: string, id: string) {
  const [row] = await db
    .delete(savedSections)
    .where(and(eq(savedSections.id, id), eq(savedSections.ownerId, ownerId)))
    .returning({ id: savedSections.id });
  if (!row) throw new UserError("Saved section not found");
}
