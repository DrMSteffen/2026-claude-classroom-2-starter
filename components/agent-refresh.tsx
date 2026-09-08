"use client";

import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps the Server-Component sidebar honest. The agent owns every write to the
 * list, so there is nothing to diff — when a run finishes, re-fetch the tree
 * and let the sidebar re-render. `router.refresh()` leaves client state alone,
 * so the chat above it is untouched.
 *
 * `useAgent` here binds to the same shared registry instance <CopilotChat>
 * uses (it resolves by `agentId` too), which is why this can sit beside it and
 * see its runs.
 */
export function AgentRefresh({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { agent } = useAgent({
    agentId,
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  const isRunning = agent.isRunning;
  const wasRunning = useRef(false);

  useEffect(() => {
    // Falling edge only — the page has just rendered the current list, so a
    // refresh before the first run would be a round trip for nothing.
    if (wasRunning.current && !isRunning) {
      router.refresh();
    }
    wasRunning.current = isRunning;
  }, [isRunning, router]);

  return null;
}
