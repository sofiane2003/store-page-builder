import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as library from "@/server/library";

export const getLibrary = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => library.listSaved(context.user.id));

export const saveToLibrary = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => library.saveToLibraryInput.parse(data))
  .handler(({ data, context }) => library.saveToLibrary(context.user.id, data));

export const deleteSaved = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data, context }) => library.deleteSaved(context.user.id, data.id));
