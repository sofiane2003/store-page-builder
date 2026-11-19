import { db } from "@/db";
import { users } from "@/db/schema";

/** The app's own record of a Gateway user, made the first time they're seen. */
export async function rememberUser(user: { id: string; email: string }): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
