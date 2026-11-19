# Store Page Builder

Build product pages, landing pages and product quizzes for your online store, write them with AI in your brand's voice, and publish them to a public link or your Shopify store.

Inspired by https://ecomwize.io

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep a catalogue of products with price, description, one image and a buy link.
- Build pages of six types from ordered sections, edit them by hand and preview them at desktop and phone width.
- Have the AI write a whole page from a product angle, then rewrite any single section with an instruction.
- Save a brand profile with a voice, a default language and one of four style presets.
- Publish a page to a public link anyone can open, or push it to your Shopify store.
- Build product quizzes that recommend one of your products and count where responses ended.
- Save sections to a personal library and insert copies into any page.

Left out: accounts and sign-in, which your Gateway handles; plans and credits; in-cart upsells and bundles; AI images and ads; whole-store generation; importing from Shopify or competitor pages; the browser extension; and sales analytics.

## Setup

```sh
pnpm install
pnpm dev          # run locally behind the EveryApp dev launcher
pnpm test         # unit tests
pnpm everyapp deploy
```

No secrets or settings are required. Two optional features can be set up with `pnpm everyapp configure store-page-builder`:

- AI writing: an OpenRouter key (`everyapp provider add openrouter`). The app asks for `google/gemini-2.5-flash`. Without it, the AI buttons say so and hand editing still works.
- Shopify publishing: the Gateway's `shopify` capability (`SHOPIFY_API_TOKEN` and `SHOPIFY_HOST`, from a custom app in the store's admin with the `write_online_store_pages` scope). Each member then enters their store's address under Brand.

The release checks in `checks/` run against a packaged release with stand-ins for the AI provider and Shopify; real OpenRouter and Shopify calls and a live deployment were not exercised.

## Limitations

- Product images are up to 4 MB each.
- A countdown's end time is read in the visitor's time zone.
- Pages pushed to Shopify are plain HTML that your theme styles; they don't update by themselves after you edit the page here.
- Public pages live under `/s/` and quizzes under `/q/` on the app's own address.
