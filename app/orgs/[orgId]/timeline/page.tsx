import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import TimelineView, {
  type TimelineCard,
} from "@/components/org/TimelineView";

export default async function TimelinePage({
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

  const { data: rawCards } = await supabase
    .from("cards")
    .select(
      "id, title, status, start_at, end_at, board_id, boards!inner(id, title, color, org_id)"
    )
    .eq("boards.org_id", orgId)
    .order("created_at", { ascending: true });

  const cards = (rawCards ?? []) as unknown as TimelineCard[];

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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">타임라인</h1>
          <div className="flex gap-2">
            <Link
              href={`/orgs/${orgId}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              보드 목록
            </Link>
            <Link
              href={`/orgs/${orgId}/status`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              상태별 보기
            </Link>
          </div>
        </div>

        <TimelineView initialCards={cards} />
      </main>
    </>
  );
}
