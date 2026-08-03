import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import {
  avatarColor,
  formatDate,
  initial,
  isOverdue,
  STATUS_HEADER_STYLES,
  STATUS_LABELS,
  STATUS_ORDER,
  boardColor,
} from "@/lib/utils";

interface StatusCard {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  board_id: string;
  card_assignees: { user_id: string }[];
  boards: { id: string; title: string; color: string };
}

interface MemberRow {
  user_id: string;
  profiles: { id: string; name: string } | null;
}

export default async function StatusPage({
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
    supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
  ]);
  if (!org) notFound();

  const [{ data: rawCards }, { data: members }] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, title, status, due_date, board_id, card_assignees(user_id), boards!inner(id, title, color, org_id)"
      )
      .eq("boards.org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_members")
      .select("user_id, profiles(id, name)")
      .eq("org_id", orgId),
  ]);

  const cards = (rawCards ?? []) as unknown as StatusCard[];
  const nameById = new Map(
    ((members ?? []) as unknown as MemberRow[]).map((m) => [
      m.user_id,
      m.profiles?.name ?? "?",
    ])
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">상태별 보기</h1>
          <div className="flex gap-2">
            <Link
              href={`/orgs/${orgId}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              보드 목록
            </Link>
            <Link
              href={`/orgs/${orgId}/timeline`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              타임라인
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUS_ORDER.map((status) => {
            const statusCards = cards.filter((c) => c.status === status);
            return (
              <section
                key={status}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <header
                  className={`flex items-center justify-between rounded-t-xl px-4 py-2.5 text-white ${STATUS_HEADER_STYLES[status]}`}
                >
                  <h2 className="text-sm font-bold">{STATUS_LABELS[status]}</h2>
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                    {statusCards.length}
                  </span>
                </header>
                <ul className="space-y-2 p-3">
                  {statusCards.length === 0 && (
                    <li className="py-6 text-center text-sm text-slate-300">
                      해당 상태의 업무가 없습니다.
                    </li>
                  )}
                  {statusCards.map((card) => (
                    <li key={card.id}>
                      <Link
                        href={`/board/${card.board_id}?card=${card.id}`}
                        className="block rounded-lg border border-slate-200 p-3 transition hover:border-sky-300 hover:shadow-sm"
                      >
                        <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded ${boardColor(card.boards.color).tile}`}
                          />
                          {card.boards.title}
                        </p>
                        <p className="text-sm font-medium text-slate-800">
                          {card.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {card.due_date && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                isOverdue(card.due_date) && status !== "done"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {formatDate(card.due_date)}
                            </span>
                          )}
                          <span className="flex-1" />
                          {card.card_assignees.slice(0, 4).map((a) => (
                            <span
                              key={a.user_id}
                              title={nameById.get(a.user_id)}
                              className={`-ml-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white ${avatarColor(a.user_id)}`}
                            >
                              {initial(nameById.get(a.user_id) ?? "?")}
                            </span>
                          ))}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
