import { createMiddleware } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { rememberUser } from "@/server/users";

/** The signed-in member, with the app's own user row made on first sight. */
export const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => {
    await rememberUser(context.user);
    return next();
  });
