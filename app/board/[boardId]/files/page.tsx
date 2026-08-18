import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import FileList from "@/components/org/FileList";
import { fetchAttachments, fetchBoardWithMembers } from "@/lib/view-data";

export default async function BoardFilesPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const [boardData, items] = await Promise.all([
    fetchBoardWithMembers(supabase, boardId),
    fetchAttachments(supabase, { boardId }),
  ]);
  if (!boardData) notFound();
  const { board } = boardData;

  return (
    <>
      <AppHeader userId={user.id} userName={user.name} />
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
          <h1 className="text-2xl font-bold">{board.title} — 첨부 파일</h1>
          <ViewTabs base={`/board/${boardId}`} type="board" active="files" />
        </div>

        <FileList items={items} showBoardName={false} />
      </main>
    </>
  );
}
