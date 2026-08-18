import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import AssigneeFilter from "@/components/AssigneeFilter";
import StatusView from "@/components/org/StatusView";
import {
  assigneeCounts,
  fetchOrgMembers,
  fetchScopedCards,
  filterByAssignee,
} from "@/lib/view-data";
import { assigneeParam, parseAssigneeParam } from "@/lib/utils";

export default async function OrgStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ assignee?: string }>;
}) {
  const [{ orgId }, { assignee }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  // 서로 의존하지 않으므로 한 번에 병렬로 (왕복 1회)
  const [{ data: org }, allCards, members] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle(),
    fetchScopedCards(supabase, { orgId }),
    fetchOrgMembers(supabase, orgId),
  ]);
  if (!org) notFound();

  const filter = parseAssigneeParam(
    assignee,
    members.map((m) => m.user_id)
  );
  const cards = filterByAssignee(allCards, filter);
  const namesById = Object.fromEntries(
    members.map((m) => [m.user_id, m.profiles?.name ?? "?"])
  );

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
            href={`/orgs/${orgId}`}
            className="hover:text-sky-600 hover:underline"
          >
            {org.name}
          </Link>{" "}
          /
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">상태별 보기</h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeFilter
              members={members}
              selected={filter}
              counts={assigneeCounts(allCards)}
            />
            <ViewTabs
              base={`/orgs/${orgId}`}
              type="org"
              active="status"
              query={assigneeParam(filter)}
            />
          </div>
        </div>

        <StatusView cards={cards} namesById={namesById} />
      </main>
    </>
  );
}
