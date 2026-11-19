import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { brandProfiles } from "@/db/schema";
import { presetIds } from "@/lib/sections";

export const brandInput = z.object({
  brandName: z.string().trim().max(120),
  voice: z.string().trim().max(2000),
  language: z.string().trim().min(1, "Default language is required").max(40),
  preset: z.enum(presetIds),
  shopifyStore: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .refine(
      (v) => v === "" || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v),
      "Use the store's host, like your-store.myshopify.com",
    ),
});
export type Brand = z.infer<typeof brandInput>;

const DEFAULT: Brand = { brandName: "", voice: "", language: "English", preset: "clean", shopifyStore: "" };

export async function getBrand(userId: string): Promise<Brand> {
  const [row] = await db.select().from(brandProfiles).where(eq(brandProfiles.userId, userId));
  if (!row) return DEFAULT;
  return brandInput.parse(row);
}

export async function saveBrand(userId: string, input: Brand): Promise<Brand> {
  const values = { ...input, updatedAt: new Date().toISOString() };
  await db
    .insert(brandProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: brandProfiles.userId, set: values });
  return input;
}
