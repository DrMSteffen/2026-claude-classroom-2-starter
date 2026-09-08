"use client";

import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ReactNode } from "react";
import { AgentRefresh } from "@/components/agent-refresh";
import { ToolCallRenderer } from "@/components/tool-call-renderer";

/**
 * `threadId` is handed down from the server-rendered session rather than picked
 * here, so a reload rejoins the same Mastra thread instead of starting a new
 * one. See lib/tutor.ts for why a forged one is useless.
 *
 * `sidebar` is the Server-Component list from app/page.tsx, passed through as a
 * prop because it has to render inside this provider for <AgentRefresh> to sit
 * beside it.
 */
export function Chat({
  agentId,
  threadId,
  sidebar,
}: {
  agentId: string;
  threadId: string;
  sidebar: ReactNode;
}) {
  return (
    // The Inspector is on by default in development builds and never loads in a
    // production one, so `enableInspector` is left unset deliberately;
    // `showDevConsole` is deprecated and no longer controls it either way.
    // app/globals.css moves its launcher off the header's sign-out button.
    <CopilotKit runtimeUrl="/api/copilotkit" credentials="include">
      <ToolCallRenderer />
      <div className="flex h-full">
        <div className="min-w-0 flex-1">
          <CopilotChat
            agentId={agentId}
            threadId={threadId}
            className="mx-auto h-full w-full max-w-3xl"
            labels={{
              chatInputPlaceholder: "Add something to the list…",
            }}
          />
        </div>
        <aside className="hidden w-72 shrink-0 border-l border-zinc-200 bg-white sm:block dark:border-zinc-800 dark:bg-zinc-950">
          <AgentRefresh agentId={agentId} />
          {sidebar}
        </aside>
      </div>
    </CopilotKit>
  );
}
