import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import AssigneeFilter from "@/components/AssigneeFilter";
import ReportView from "@/components/org/ReportView";
import {
  assigneeCounts,
  fetchBoardWithMembers,
  fetchReportData,
  fetchScopedCards,
  filterByAssignee,
} from "@/lib/view-data";
import { assigneeParam, parseAssigneeParam } from "@/lib/utils";

export default async function BoardReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ assignee?: string }>;
}) {
  const [{ boardId }, { assignee }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  // 담당자 필터가 없으면 보고서 집계도 카드에 의존하지 않으므로 함께 병렬로
  const [boardData, allCards, unfilteredReport] = await Promise.all([
    fetchBoardWithMembers(supabase, boardId),
    fetchScopedCards(supabase, { boardId }),
    assignee ? null : fetchReportData(supabase, { boardId }),
  ]);
  if (!boardData) notFound();
  const { board, members } = boardData;

  const filter = parseAssigneeParam(
    assignee,
    members.map((m) => m.user_id)
  );
  const cards = filterByAssignee(allCards, filter);
  const namesById = Object.fromEntries(
    members.map((m) => [m.user_id, m.profiles?.name ?? "?"])
  );

  const report =
    unfilteredReport ??
    (await fetchReportData(supabase, { boardId }, cards.map((c) => c.id)));

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
          <h1 className="text-2xl font-bold">{board.title} — 보고서</h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeFilter
              members={members}
              selected={filter}
              counts={assigneeCounts(allCards)}
            />
            <ViewTabs
              base={`/board/${boardId}`}
              type="board"
              active="report"
              query={assigneeParam(filter)}
            />
          </div>
        </div>

        <ReportView
          cards={cards}
          activities={report.activities}
          counts={report.counts}
          namesById={namesById}
        />
      </main>
    </>
  );
}
