"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import {
  summarizeToolCall,
  type ToolCallProps,
} from "@/components/tool-call-summary";
import { ToolCall } from "@/components/ui/tool-call";

/**
 * Renders every tool call the agent makes into the transcript, so the chat
 * shows what was actually done to the list rather than only what the agent
 * says about it. Registered as the wildcard `"*"` renderer: nothing here
 * registers a name-matched one for it to fall back from, so it catches every
 * tool call, including from any tool added later.
 *
 * The wildcard render props are typed `any` — a wildcard has no argument
 * schema to infer from — which is also why no zod schema is needed on the
 * client. Renders nothing itself; it has to sit inside the CopilotKit provider.
 */
export function ToolCallRenderer() {
  useRenderTool(
    {
      name: "*",
      render: (props: ToolCallProps) => (
        <ToolCall
          name={props.name}
          detail={summarizeToolCall(props)}
          running={props.status !== "complete"}
        />
      ),
    },
    [],
  );

  return null;
}
