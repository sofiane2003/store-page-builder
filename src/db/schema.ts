import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(current_timestamp)`;

// One row per Gateway user (`user.id`), made the first time they open the app.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const brandProfiles = sqliteTable("brand_profiles", {
  userId: text("user_id").primaryKey(),
  brandName: text("brand_name").notNull().default(""),
  voice: text("voice").notNull().default(""),
  language: text("language").notNull().default("English"),
  preset: text("preset").notNull().default("clean"),
  shopifyStore: text("shopify_store").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(now),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull(),
    description: text("description").notNull().default(""),
    imageKey: text("image_key"),
    buyUrl: text("buy_url").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("products_owner").on(t.ownerId)],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    productId: text("product_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    language: text("language").notNull(),
    preset: text("preset").notNull(),
    status: text("status").notNull().default("draft"),
    // The ordered sections, as JSON (src/lib/sections.ts). One column, so a
    // reorder or an AI rewrite is one statement.
    sections: text("sections").notNull().default("[]"),
    shopifyPageId: text("shopify_page_id"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("pages_owner").on(t.ownerId), index("pages_product").on(t.productId)],
);

export const pageMessages = sqliteTable(
  "page_messages",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id").notNull(),
    sectionId: text("section_id").notNull(),
    role: text("role").notNull(),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("page_messages_page").on(t.pageId)],
);

export const savedSections = sqliteTable(
  "saved_sections",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("saved_sections_owner").on(t.ownerId)],
);

export const quizzes = sqliteTable(
  "quizzes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    intro: text("intro").notNull().default(""),
    status: text("status").notNull().default("draft"),
    // The ordered questions with their answers and points, as JSON
    // (src/lib/quiz.ts).
    questions: text("questions").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("quizzes_owner").on(t.ownerId)],
);

// Which product each quiz uses, kept with the quiz, so a product in use
// can't be deleted.
export const quizProducts = sqliteTable(
  "quiz_products",
  {
    quizId: text("quiz_id").notNull(),
    productId: text("product_id").notNull(),
  },
  (t) => [index("quiz_products_quiz").on(t.quizId), index("quiz_products_product").on(t.productId)],
);

export const quizResponses = sqliteTable(
  "quiz_responses",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id").notNull(),
    resultProductId: text("result_product_id").notNull(),
    answers: text("answers").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("quiz_responses_quiz").on(t.quizId)],
);
