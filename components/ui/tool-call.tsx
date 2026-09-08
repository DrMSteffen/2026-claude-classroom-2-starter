/** The one look for a tool call in the transcript: a quiet note in the margin. */
export function ToolCall({
  name,
  detail,
  running,
}: {
  name: string;
  detail: string;
  running: boolean;
}) {
  return (
    <div
      className="my-1 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
      data-testid="tool-call"
      data-tool={name}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          running
            ? "animate-pulse bg-zinc-400 dark:bg-zinc-500"
            : "bg-emerald-500"
        }`}
      />
      <span className="text-zinc-600 dark:text-zinc-300">{name}</span>
      <span className="text-zinc-400 dark:text-zinc-500">{detail}</span>
    </div>
  );
}
