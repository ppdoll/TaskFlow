import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import AssigneeFilter from "@/components/AssigneeFilter";
import ReportView from "@/components/org/ReportView";
import {
  assigneeCounts,
  fetchOrgMembers,
  fetchReportData,
  fetchScopedCards,
  filterByAssignee,
} from "@/lib/view-data";
import { ASSIGNEE_ALL, normalizeAssigneeFilter } from "@/lib/utils";

export default async function OrgReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ assignee?: string }>;
}) {
  const [{ orgId }, { assignee }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle(),
  ]);
  if (!org) notFound();

  const [allCards, members] = await Promise.all([
    fetchScopedCards(supabase, { orgId }),
    fetchOrgMembers(supabase, orgId),
  ]);

  const filter = normalizeAssigneeFilter(
    assignee,
    members.map((m) => m.user_id)
  );
  const cards = filterByAssignee(allCards, filter);
  const namesById = Object.fromEntries(
    members.map((m) => [m.user_id, m.profiles?.name ?? "?"])
  );

  // 담당자 필터가 걸리면 통계·활동도 그 담당자의 카드로 제한한다
  const report = await fetchReportData(
    supabase,
    { orgId },
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
            href={`/orgs/${orgId}`}
            className="hover:text-sky-600 hover:underline"
          >
            {org.name}
          </Link>{" "}
          /
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">보고서</h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeFilter
              members={members}
              value={filter}
              counts={assigneeCounts(allCards)}
            />
            <ViewTabs
              base={`/orgs/${orgId}`}
              type="org"
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
