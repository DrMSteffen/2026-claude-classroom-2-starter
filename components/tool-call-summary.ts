/**
 * What the to-do tools hand back to the model — the shape `lib/todo-tools.ts`
 * declares in its output schemas, read here from the serialized tool result.
 */
type ModelTodo = { id: string; title: string; done: boolean };

/**
 * A tool call as CopilotKit's wildcard renderer reports it. The statuses are
 * its own: `inProgress` while the model is still writing the arguments,
 * `executing` while the server runs the tool, `complete` once it has answered.
 */
export type ToolCallProps = {
  name: string;
  args: Record<string, unknown>;
  status: "inProgress" | "executing" | "complete";
  result?: string;
};

function parseResult(result: string | undefined): unknown {
  if (!result) {
    return undefined;
  }
  try {
    return JSON.parse(result);
  } catch {
    // A tool that answered with plain text, or with an error string.
    return undefined;
  }
}

function isTodo(value: unknown): value is ModelTodo {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ModelTodo).title === "string" &&
    typeof (value as ModelTodo).done === "boolean"
  );
}

function quote(title: unknown) {
  return typeof title === "string" ? `“${title}”` : "an item";
}

/**
 * One line of plain English per tool call. Every branch has a fallback: the
 * result arrives as an opaque string, so a tool whose output does not parse
 * still reads as a tool call rather than as nothing at all.
 */
export function summarizeToolCall({
  name,
  args,
  status,
  result,
}: ToolCallProps): string {
  const parsed = status === "complete" ? parseResult(result) : undefined;
  const field = (key: string) =>
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)[key]
      : undefined;

  switch (name) {
    case "listTodos": {
      const todos = field("todos");
      if (!Array.isArray(todos)) {
        return status === "complete" ? "read the list" : "reading the list";
      }
      return todos.length === 1
        ? "1 item on the list"
        : `${todos.length} items on the list`;
    }

    case "addTodo": {
      const added = field("todo");
      if (isTodo(added)) {
        return `added ${quote(added.title)}`;
      }
      return status === "complete"
        ? `added ${quote(args.title)}`
        : `adding ${quote(args.title)}`;
    }

    case "setTodoDone": {
      const updated = field("updated");
      if (isTodo(updated)) {
        return updated.done
          ? `ticked ${quote(updated.title)} off`
          : `put ${quote(updated.title)} back on`;
      }
      if (status === "complete") {
        // `updated: null` — the id is on nobody's list, or on someone else's.
        return parsed === undefined
          ? "updated an item"
          : "no such item on the list";
      }
      return args.done === false ? "reopening an item" : "ticking an item off";
    }

    default:
      return status === "complete" ? "done" : "working";
  }
}
