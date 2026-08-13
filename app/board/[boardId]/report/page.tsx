import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import AssigneeFilter from "@/components/AssigneeFilter";
import ReportView from "@/components/org/ReportView";
import {
  assigneeCounts,
  fetchBoardContext,
  fetchOrgMembers,
  fetchReportData,
  fetchScopedCards,
  filterByAssignee,
} from "@/lib/view-data";
import { ASSIGNEE_ALL, normalizeAssigneeFilter } from "@/lib/utils";

export default async function BoardReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ assignee?: string }>;
}) {
  const [{ boardId }, { assignee }] = await Promise.all([params, searchParams]);
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

  const [allCards, members] = await Promise.all([
    fetchScopedCards(supabase, { boardId }),
    fetchOrgMembers(supabase, board.org_id),
  ]);

  const filter = normalizeAssigneeFilter(
    assignee,
    members.map((m) => m.user_id)
  );
  const cards = filterByAssignee(allCards, filter);
  const namesById = Object.fromEntries(
    members.map((m) => [m.user_id, m.profiles?.name ?? "?"])
  );

  const report = await fetchReportData(
    supabase,
    { boardId },
    filter === ASSIGNEE_ALL ? null : cards.map((c) => c.id)
  );

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
          <h1 className="text-2xl font-bold">{board.title} — 보고서</h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeFilter
              members={members}
              value={filter}
              counts={assigneeCounts(allCards)}
            />
            <ViewTabs
              base={`/board/${boardId}`}
              type="board"
              active="report"
              query={filter === ASSIGNEE_ALL ? undefined : `assignee=${filter}`}
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
