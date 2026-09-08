import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { Todo } from "@/lib/schema";
import { addTodo, listTodos, setTodoDone, type TodosDb } from "@/lib/todos";

/**
 * What the CopilotKit route puts on the request context, and the only place the
 * tools below get a user id from. It is set from the verified session, so a
 * user id in a tool argument or anywhere else in the request would be ignored
 * even if the model invented one.
 */
export type TutorRequestContext = { userId: string };

/**
 * Builds that context. The route calls this with the session's user id, and it
 * is the one place the `userId` key is written, so nothing else can spell it.
 */
export function tutorRequestContext(userId: string) {
  const requestContext = new RequestContext();
  requestContext.set("userId", userId satisfies TutorRequestContext["userId"]);
  return requestContext;
}

// Validated before `execute` runs; a request context without a user id fails
// the tool call rather than falling through to an unscoped query.
const requestContextSchema = z.object({ userId: z.string().min(1) });

const todoSchema = z.object({
  id: z.string().describe("Pass this to setTodoDone to tick the item off."),
  title: z.string(),
  done: z.boolean(),
});

/** The row shape the model sees — no user id, no timestamps. */
function toModelTodo(row: Todo) {
  return { id: row.id, title: row.title, done: row.done };
}

function userIdOf(context: {
  requestContext?: RequestContext<TutorRequestContext>;
}) {
  const userId = context.requestContext?.get("userId");
  if (typeof userId !== "string" || userId === "") {
    // requestContextSchema should have caught this; a tool that queried
    // without an owner would be the one real way to leak another user's list.
    throw new Error("no userId on the request context");
  }
  return userId;
}

/**
 * The tutor's three tools over one connection. A factory rather than three
 * exported constants so the unit tests can bind them to a throwaway database.
 */
export function createTodoTools(db: TodosDb) {
  return {
    listTodos: createTool({
      id: "listTodos",
      description: "Read back every item on the user's to-do list.",
      inputSchema: z.object({}),
      outputSchema: z.object({ todos: z.array(todoSchema) }),
      requestContextSchema,
      execute: async (_input, context) => {
        const rows = await listTodos(db, userIdOf(context));
        return { todos: rows.map(toModelTodo) };
      },
    }),

    addTodo: createTool({
      id: "addTodo",
      description:
        "Put one new item on the user's to-do list. Use the user's own wording.",
      inputSchema: z.object({
        title: z.string().min(1).describe("The item, as a short phrase."),
      }),
      outputSchema: z.object({ todo: todoSchema }),
      requestContextSchema,
      execute: async ({ title }, context) => {
        const row = await addTodo(db, userIdOf(context), title);
        return { todo: toModelTodo(row) };
      },
    }),

    setTodoDone: createTool({
      id: "setTodoDone",
      description:
        "Tick an item off the user's to-do list, or put it back on. Call listTodos first if you do not already have the item's id.",
      inputSchema: z.object({
        id: z.string().describe("The item's id, as returned by listTodos."),
        done: z.boolean().describe("True to complete it, false to reopen it."),
      }),
      outputSchema: z.object({
        // Null rather than an error so the model can say so plainly.
        updated: todoSchema
          .nullable()
          .describe("Null when the user's list holds no item with that id."),
      }),
      requestContextSchema,
      execute: async ({ id, done }, context) => {
        const row = await setTodoDone(db, userIdOf(context), id, done);
        return { updated: row ? toModelTodo(row) : null };
      },
    }),
  };
}
