import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import StatusView from "@/components/org/StatusView";
import {
  fetchBoardContext,
  fetchMemberNames,
  fetchScopedCards,
} from "@/lib/view-data";

export default async function BoardStatusPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, board] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    fetchBoardContext(supabase, boardId),
  ]);
  if (!board) notFound();

  const [cards, namesById] = await Promise.all([
    fetchScopedCards(supabase, { boardId }),
    fetchMemberNames(supabase, board.org_id),
  ]);

  return (
    <>
      <AppHeader userId={user.id} userName={profile?.name ?? ""} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-2 text-sm text-slate-400">
          <Link href="/orgs" className="hover:text-sky-600 hover:underline">
            내 조직
          </Link>{" "}
          /{" "}
          <Link
            href={`/orgs/${board.org_id}`}
            className="hover:text-sky-600 hover:underline"
          >
            {board.orgName}
          </Link>{" "}
          /{" "}
          <Link
            href={`/board/${boardId}`}
            className="hover:text-sky-600 hover:underline"
          >
            {board.title}
          </Link>{" "}
          /
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{board.title} — 상태별</h1>
          <ViewTabs base={`/board/${boardId}`} type="board" active="status" />
        </div>

        <StatusView cards={cards} namesById={namesById} showBoardName={false} />
      </main>
    </>
  );
}
