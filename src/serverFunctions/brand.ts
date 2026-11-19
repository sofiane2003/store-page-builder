import { createServerFn } from "@tanstack/react-start";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as brand from "@/server/brand";

export const getBrand = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => brand.getBrand(context.user.id));

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => brand.brandInput.parse(data))
  .handler(({ data, context }) => brand.saveBrand(context.user.id, data));
