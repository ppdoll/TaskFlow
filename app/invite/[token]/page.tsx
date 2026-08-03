import { createClient } from "@/lib/supabase/server";
import AcceptInvite from "@/components/org/AcceptInvite";

interface InviteInfo {
  org_id: string | null;
  org_name: string | null;
  allowed_domains: string[] | null;
  status: "VALID" | "NOT_FOUND" | "EXPIRED" | "EXHAUSTED";
}

const STATUS_MESSAGES: Record<string, string> = {
  NOT_FOUND: "존재하지 않는 초대 링크입니다.",
  EXPIRED: "만료된 초대 링크입니다. 조직장에게 새 링크를 요청하세요.",
  EXHAUSTED: "사용 횟수가 모두 소진된 초대 링크입니다.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: { user } }, { data: infoRows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_invite_info", { p_token: token }),
  ]);

  const info = (infoRows?.[0] ?? { status: "NOT_FOUND" }) as InviteInfo;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-8 text-3xl font-bold text-sky-700">업무보드</h1>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {info.status !== "VALID" ? (
            <>
              <p className="text-4xl">😥</p>
              <p className="mt-4 text-slate-600">
                {STATUS_MESSAGES[info.status]}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">조직 초대</p>
              <h2 className="mt-1 text-2xl font-bold">{info.org_name}</h2>
              {info.allowed_domains && info.allowed_domains.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  이 조직은{" "}
                  <strong>@{info.allowed_domains.join(", @")}</strong> 이메일
                  계정만 참여할 수 있습니다.
                </p>
              )}
              <AcceptInvite
                token={token}
                isLoggedIn={!!user}
                userEmail={user?.email ?? null}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
