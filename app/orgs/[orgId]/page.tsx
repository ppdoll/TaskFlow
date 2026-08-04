import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import CreateBoardForm from "@/components/org/CreateBoardForm";
import { avatarColor, boardTheme, initial, ROLE_LABELS } from "@/lib/utils";
import type { Board, OrgMember } from "@/lib/types";

export default async function OrgPage({
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
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  if (!org) notFound();

  const [{ data: boards }, { data: members }] = await Promise.all([
    supabase
      .from("boards")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_members")
      .select("*, profiles(id, email, name)")
      .eq("org_id", orgId)
      .order("joined_at", { ascending: true }),
  ]);

  const memberRows = (members ?? []) as unknown as OrgMember[];
  const boardRows = (boards ?? []) as Board[];
  const myRole = memberRows.find((m) => m.user_id === user.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <>
      <AppHeader userId={user.id} userName={profile?.name ?? ""} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-2 text-sm text-slate-400">
          <Link href="/orgs" className="hover:text-sky-600 hover:underline">
            내 조직
          </Link>{" "}
          /
        </div>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ViewTabs base={`/orgs/${orgId}`} type="org" active="main" />
            {canManage && (
              <Link
                href={`/orgs/${orgId}/settings`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                ⚙️ 설정 · 초대
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
          <section>
            <h2 className="mb-4 text-lg font-semibold">보드</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {boardRows.map((board) => {
                const theme = boardTheme(board.color);
                const isOwner = board.created_by === user.id;
                const ownerName = board.created_by
                  ? memberRows.find((m) => m.user_id === board.created_by)
                      ?.profiles?.name
                  : null;
                return (
                  <Link
                    key={board.id}
                    href={`/board/${board.id}`}
                    className="flex h-28 flex-col justify-between rounded-xl p-4 shadow-sm transition hover:opacity-90 hover:shadow-md"
                    style={{
                      backgroundColor: theme.tile,
                      color: theme.onTile,
                    }}
                  >
                    <span className="font-semibold">{board.title}</span>
                    <span className="flex items-center gap-1.5">
                      {isOwner ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: theme.onTile,
                            color: theme.tile,
                          }}
                          title="내가 만든 보드입니다"
                        >
                          소유주
                        </span>
                      ) : (
                        ownerName && (
                          <span className="text-xs opacity-80">
                            {ownerName}
                          </span>
                        )
                      )}
                    </span>
                  </Link>
                );
              })}
              <CreateBoardForm orgId={orgId} />
            </div>
          </section>

          <aside>
            <h2 className="mb-4 text-lg font-semibold">
              멤버{" "}
              <span className="text-sm font-normal text-slate-400">
                {memberRows.length}명
              </span>
            </h2>
            <ul className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              {memberRows.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(m.user_id)}`}
                  >
                    {initial(m.profiles?.name ?? "")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.profiles?.name}
                      {m.user_id === user.id && (
                        <span className="ml-1 text-xs text-slate-400">
                          (나)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {ROLE_LABELS[m.role]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </>
  );
}
