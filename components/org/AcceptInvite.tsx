"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  INVITE_NOT_FOUND: "존재하지 않는 초대 링크입니다.",
  INVITE_EXPIRED: "만료된 초대 링크입니다.",
  INVITE_EXHAUSTED: "사용 횟수가 모두 소진된 초대 링크입니다.",
  DOMAIN_NOT_ALLOWED:
    "이 조직은 허용된 이메일 도메인의 계정만 참여할 수 있습니다. 회사 이메일로 가입한 계정으로 다시 시도해주세요.",
  NOT_AUTHENTICATED: "로그인이 필요합니다.",
};

export default function AcceptInvite({
  token,
  isLoggedIn,
  userEmail,
}: {
  token: string;
  isLoggedIn: boolean;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("accept_invite", {
      p_token: token,
    });

    setLoading(false);
    if (error) {
      const known = Object.keys(ERROR_MESSAGES).find((k) =>
        error.message.includes(k)
      );
      setError(known ? ERROR_MESSAGES[known] : error.message);
      return;
    }
    router.push(`/orgs/${data}`);
    router.refresh();
  }

  if (!isLoggedIn) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-slate-500">
          조직에 참여하려면 먼저 로그인하세요.
        </p>
        <button
          onClick={() =>
            router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
          }
          className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          로그인 후 참여하기
        </button>
        <button
          onClick={() =>
            router.push(
              `/signup?next=${encodeURIComponent(`/invite/${token}`)}`
            )
          }
          className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          회원가입 후 참여하기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {userEmail && (
        <p className="text-xs text-slate-400">{userEmail} 계정으로 참여</p>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
      >
        {loading ? "참여 중..." : "조직 참여하기"}
      </button>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
