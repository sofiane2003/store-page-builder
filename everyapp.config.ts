import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "store-page-builder",
  name: "Store Page Builder",
  description: "Build product pages, landing pages and product quizzes for your store, write them with AI, and publish them to a link or your Shopify store.",
  icon: "/icon.svg",
  resources: {
    // Products, pages, quizzes, the section library and brand profiles.
    d1: ["DB"],
    // Product images.
    r2: ["files"],
  },
  // Every member can build their own pages.
  access: "everyone",
  // What shoppers open without signing in: published pages and quizzes,
  // a quiz's answers, the product images they show, and the built assets
  // those pages load. Each checks it serves only published content.
  public: [
    { path: "/s/:slug", methods: ["GET"] },
    { path: "/q/:slug", methods: ["GET"] },
    { path: "/q/:slug/submit", methods: ["POST"] },
    { path: "/f/**", methods: ["GET"] },
  ],
  publicAssets: ["/assets/**", "/icon.svg"],
  providers: [
    {
      id: "openrouter",
      why: "Writes pages and rewrites sections.",
      docs: "https://openrouter.ai/settings/keys",
    },
  ],
  capabilities: {
    shopify: {
      access: "write",
      why: "Publishes pages to your store as online-store pages.",
      docs: "https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin",
    },
  },
  features: {
    ai: {
      name: "AI writing",
      why: "Writes whole pages and rewrites single sections on request.",
      providers: ["openrouter"],
    },
    shopify: {
      name: "Shopify publishing",
      why: "Pushes pages to your Shopify store as online-store pages.",
      capabilities: ["shopify"],
    },
  },
});
