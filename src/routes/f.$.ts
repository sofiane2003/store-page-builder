import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { imageVisible } from "@/server/images";

// Product images. Public (everyapp.config.ts) so published pages and quizzes
// can show them; src/server/images.ts decides which key each caller may see.
export const Route = createFileRoute("/f/$")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
        const key = params._splat ?? "";
        if (!/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) return new Response("Not found", { status: 404 });
        const user = await getEveryAppUser(request, env);
        if (!(await imageVisible(key, user?.id ?? null))) return new Response("Not found", { status: 404 });
        const object = await env.files.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
