import { and, asc, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/libsql/node";
import type * as schema from "@/lib/schema";
import { todos } from "@/lib/schema";

/**
 * The connection the helpers below run on. lib/db.ts is `server-only`, so the
 * type is spelled out the same way it is there and the caller hands the
 * instance in — the app passes `db`, the unit tests a temp-file one.
 */
export type TodosDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Every helper takes `userId` as its own argument and puts it in the WHERE
 * clause. That is the whole isolation story for the list: a row is only ever
 * read or written through a query that names its owner, so nothing the model
 * or the browser sends can reach another user's items.
 */
export function listTodos(db: TodosDb, userId: string) {
  return (
    db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      // todos.createdAt defaults to unixepoch(), which only resolves to the
      // second, and the id is a random UUID — so two items captured in the same
      // second would swap places between renders. SQLite's implicit rowid is
      // insertion order, which is exactly the tiebreak the list wants.
      .orderBy(asc(todos.createdAt), asc(sql`rowid`))
  );
}

export async function addTodo(db: TodosDb, userId: string, title: string) {
  const [row] = await db.insert(todos).values({ userId, title }).returning();
  return row;
}

/** Undefined when no such row exists *for this user* — missing or someone else's. */
export async function setTodoDone(
  db: TodosDb,
  userId: string,
  id: string,
  done: boolean,
) {
  const [row] = await db
    .update(todos)
    .set({ done })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();
  return row;
}
