import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import ReportView from "@/components/org/ReportView";
import {
  fetchMemberNames,
  fetchReportData,
  fetchScopedCards,
} from "@/lib/view-data";

export default async function OrgReportPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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

  const [cards, namesById, report] = await Promise.all([
    fetchScopedCards(supabase, { orgId }),
    fetchMemberNames(supabase, orgId),
    fetchReportData(supabase, { orgId }),
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
            href={`/orgs/${orgId}`}
            className="hover:text-sky-600 hover:underline"
          >
            {org.name}
          </Link>{" "}
          /
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">보고서</h1>
          <ViewTabs base={`/orgs/${orgId}`} type="org" active="report" />
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
