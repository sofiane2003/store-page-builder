import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { memberMiddleware } from "@/serverFunctions/middleware";
import * as products from "@/server/products";

export const getProducts = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => products.listProducts(context.user.id));

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => products.productInput.parse(data))
  .handler(({ data, context }) => products.saveProduct(context.user.id, data));

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => products.imageInput.parse(data))
  .handler(({ data, context }) => products.setProductImage(context.user.id, data));

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(({ data, context }) => products.deleteProduct(context.user.id, data.id));
