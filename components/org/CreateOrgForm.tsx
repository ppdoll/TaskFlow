"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateOrgForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const domainList = domains
      .split(",")
      .map((d) => d.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);

    const { data, error } = await supabase.rpc("create_organization", {
      p_name: name.trim(),
      p_domains: domainList.length > 0 ? domainList : null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOpen(false);
    setName("");
    setDomains("");
    router.push(`/orgs/${data}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
      >
        + 새 조직 만들기
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h3 className="mb-4 text-lg font-semibold">새 조직 만들기</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            조직 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 개발팀"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            허용 이메일 도메인 (선택)
          </label>
          <input
            type="text"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="예: billionairegames.co.kr (쉼표로 여러 개 입력)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          <p className="mt-1 text-xs text-slate-400">
            입력하면 해당 도메인의 이메일 계정만 초대 링크로 가입할 수
            있습니다. 비워두면 제한이 없습니다.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? "생성 중..." : "만들기"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            취소
          </button>
        </div>
      </div>
    </form>
  );
}
