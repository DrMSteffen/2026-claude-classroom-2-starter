// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RequestContext } from "@mastra/core/request-context";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import * as schema from "@/lib/schema";
import { todos, user } from "@/lib/schema";
import { createTodoTools, tutorRequestContext } from "@/lib/todo-tools";

// lib/tutor.ts binds the tools to the `server-only` connection in lib/db.ts, so
// the factory exists to let this file bind them to a throwaway file instead.
let dir: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let tools: ReturnType<typeof createTodoTools>;

/** What the tools hand back to the model. */
type ModelTodo = { id: string; title: string; done: boolean };

/**
 * `Tool.execute` is typed optional — a tool may be run somewhere else entirely
 * — and its return type includes the request-context validation error, so the
 * one cast lives here rather than at every call site. The runtime fills the
 * rest of the execution context; only `requestContext` reaches these tools.
 */
function call<Result>(
  tool: (typeof tools)[keyof typeof tools],
  input: unknown,
  requestContext: RequestContext,
) {
  const execute = tool.execute as (
    input: unknown,
    context: { requestContext: RequestContext },
  ) => Promise<Result>;
  return execute(input, { requestContext });
}

const addTodo = (userId: string, title: string) =>
  call<{ todo: ModelTodo }>(
    tools.addTodo,
    { title },
    tutorRequestContext(userId),
  );

const listTodos = (userId: string) =>
  call<{ todos: ModelTodo[] }>(
    tools.listTodos,
    {},
    tutorRequestContext(userId),
  );

const setTodoDone = (userId: string, id: string, done: boolean) =>
  call<{ updated: ModelTodo | null }>(
    tools.setTodoDone,
    { id, done },
    tutorRequestContext(userId),
  );

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-tutor-tools-"));
  db = drizzle({ connection: { url: `file:${join(dir, "test.db")}` }, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  tools = createTodoTools(db);

  // todos.userId is a FK onto the Better Auth user table.
  await db.insert(user).values([
    { id: "user-1", name: "User One", email: "one@example.com" },
    { id: "user-2", name: "User Two", email: "two@example.com" },
  ]);
});

afterAll(async () => {
  db.$client.close();
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(todos);
});

describe("addTodo", () => {
  test("writes the item against the request context's user", async () => {
    const { todo } = await addTodo("user-1", "Buy milk");

    expect(todo).toEqual({
      id: expect.any(String),
      title: "Buy milk",
      done: false,
    });

    const rows = await db.select().from(todos);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user-1");
  });

  test("refuses to write without a user id on the request context", async () => {
    const result = await call<unknown>(
      tools.addTodo,
      { title: "Buy milk" },
      new RequestContext(),
    );

    // A failed requestContextSchema returns an error object rather than
    // throwing, so the assertion that matters is that nothing was written.
    expect(result).toMatchObject({ error: true });
    await expect(db.select().from(todos)).resolves.toEqual([]);
  });
});

describe("listTodos", () => {
  test("reads back only the context user's items, oldest first", async () => {
    await addTodo("user-1", "First");
    await addTodo("user-1", "Second");
    await addTodo("user-2", "Not yours");

    const mine = await listTodos("user-1");
    expect(mine.todos.map((todo) => todo.title)).toEqual(["First", "Second"]);

    const theirs = await listTodos("user-2");
    expect(theirs.todos.map((todo) => todo.title)).toEqual(["Not yours"]);
  });

  test("never hands the owner to the model", async () => {
    await addTodo("user-1", "First");

    const { todos: mine } = await listTodos("user-1");
    expect(Object.keys(mine[0])).toEqual(["id", "title", "done"]);
  });
});

describe("setTodoDone", () => {
  test("ticks the context user's own item off and back on", async () => {
    const { todo } = await addTodo("user-1", "Buy milk");

    await expect(setTodoDone("user-1", todo.id, true)).resolves.toEqual({
      updated: { ...todo, done: true },
    });
    await expect(setTodoDone("user-1", todo.id, false)).resolves.toEqual({
      updated: todo,
    });
  });

  test("cannot reach another user's item, even holding its id", async () => {
    const { todo } = await addTodo("user-1", "Buy milk");

    await expect(setTodoDone("user-2", todo.id, true)).resolves.toEqual({
      updated: null,
    });

    const [row] = await db.select().from(todos).where(eq(todos.id, todo.id));
    expect(row.done).toBe(false);
  });

  test("reports an id that is on nobody's list", async () => {
    await expect(setTodoDone("user-1", "no-such-id", true)).resolves.toEqual({
      updated: null,
    });
  });
});
