import { db } from "@/lib/db";
import { listTodos } from "@/lib/todos";

/**
 * Read-only by design: the agent is the single write path to the list, so this
 * has no controls. It is a Server Component passed down into <Chat>, and
 * components/agent-refresh.tsx re-renders it whenever a run ends.
 */
export async function TodosSidebar({ userId }: { userId: string }) {
  const items = await listTodos(db, userId);
  const open = items.filter((item) => !item.done).length;

  return (
    <div className="flex h-full flex-col" data-testid="todos-sidebar">
      <div className="flex items-baseline justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          The list
        </h2>
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
          {open}/{items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm leading-relaxed text-zinc-400 dark:text-zinc-500">
          Nothing on the list. Ask Bartholomew to take something down.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto py-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2.5 px-4 py-1.5 text-sm"
            >
              <span
                aria-hidden
                className={`mt-px select-none font-mono text-xs ${
                  item.done
                    ? "text-zinc-400 dark:text-zinc-600"
                    : "text-zinc-300 dark:text-zinc-700"
                }`}
              >
                {item.done ? "×" : "○"}
              </span>
              <span
                className={
                  item.done
                    ? "text-zinc-400 line-through dark:text-zinc-600"
                    : "text-zinc-700 dark:text-zinc-200"
                }
              >
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
