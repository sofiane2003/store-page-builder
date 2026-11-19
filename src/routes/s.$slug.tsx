import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageRenderer } from "@/client/components/PageRenderer";
import { getPublicPage } from "@/serverFunctions/public";

// A published page, open to anyone (everyapp.config.ts lists /s/:slug).
export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const page = await getPublicPage({ data: params.slug }).catch(() => null);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.title }] : [] }),
  notFoundComponent: Gone,
  component: PublicPage,
});

function PublicPage() {
  const page = Route.useLoaderData();
  return (
    <div data-testid="public-page" lang={page.language} className="h-dvh overflow-y-auto">
      <PageRenderer mode="public" preset={page.preset} sections={page.sections} product={page.product} />
    </div>
  );
}

function Gone() {
  return (
    <div className="flex h-dvh items-center justify-center p-6 text-center text-muted-foreground">
      <p>This page isn't available.</p>
    </div>
  );
}
