import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { SignOutButton } from "@/components/sign-out-button";
import { TodosSidebar } from "@/components/todos-sidebar";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/lib/auth";
import { TUTOR_AGENT_ID, tutorThreadId } from "@/lib/tutor";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader title="Bartholomew" subtitle={session.user.name}>
        <SignOutButton />
      </PageHeader>
      <main className="flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Chat
          agentId={TUTOR_AGENT_ID}
          threadId={tutorThreadId(session.user.id)}
          sidebar={<TodosSidebar userId={session.user.id} />}
        />
      </main>
    </>
  );
}
