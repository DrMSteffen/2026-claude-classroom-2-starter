import { describe, expect, test } from "vitest";

import {
  summarizeToolCall,
  type ToolCallProps,
} from "@/components/tool-call-summary";

const call = (props: Partial<ToolCallProps> & { name: string }) =>
  summarizeToolCall({ args: {}, status: "complete", ...props });

// The shapes lib/todo-tools.ts declares in its output schemas, serialized the
// way a tool result reaches the renderer.
const milk = { id: "todo-1", title: "buy milk", done: false };

describe("listTodos", () => {
  test("counts what came back", () => {
    expect(
      call({ name: "listTodos", result: JSON.stringify({ todos: [] }) }),
    ).toBe("0 items on the list");
    expect(
      call({ name: "listTodos", result: JSON.stringify({ todos: [milk] }) }),
    ).toBe("1 item on the list");
  });

  test("says what it is doing while the tool runs", () => {
    expect(call({ name: "listTodos", status: "executing" })).toBe(
      "reading the list",
    );
  });
});

describe("addTodo", () => {
  test("names the item from the result", () => {
    expect(
      call({ name: "addTodo", result: JSON.stringify({ todo: milk }) }),
    ).toBe("added “buy milk”");
  });

  test("falls back to the arguments while they stream in", () => {
    expect(
      call({
        name: "addTodo",
        args: { title: "buy milk" },
        status: "executing",
      }),
    ).toBe("adding “buy milk”");
    expect(call({ name: "addTodo", status: "inProgress" })).toBe(
      "adding an item",
    );
  });
});

describe("setTodoDone", () => {
  test("says which way the item went", () => {
    expect(
      call({
        name: "setTodoDone",
        result: JSON.stringify({ updated: { ...milk, done: true } }),
      }),
    ).toBe("ticked “buy milk” off");
    expect(
      call({ name: "setTodoDone", result: JSON.stringify({ updated: milk }) }),
    ).toBe("put “buy milk” back on");
  });

  test("reports the id that matched nothing on this user's list", () => {
    expect(
      call({ name: "setTodoDone", result: JSON.stringify({ updated: null }) }),
    ).toBe("no such item on the list");
  });
});

describe("anything else", () => {
  test("still renders as a tool call when the result does not parse", () => {
    expect(call({ name: "addTodo", result: "upstream error" })).toBe(
      "added an item",
    );
    expect(call({ name: "setTodoDone", result: "upstream error" })).toBe(
      "updated an item",
    );
  });

  test("names an unknown tool rather than dropping it", () => {
    expect(call({ name: "somethingNew", status: "executing" })).toBe("working");
    expect(call({ name: "somethingNew" })).toBe("done");
  });
});
