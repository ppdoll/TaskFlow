"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ASSIGNEE_ALL,
  ASSIGNEE_NONE,
  avatarColor,
  initial,
} from "@/lib/utils";
import type { FilterCounts } from "@/components/board/BoardFilter";
import type { OrgMember } from "@/lib/types";

/**
 * 상태별·타임라인·캘린더·보고서 공용 담당자 필터.
 * 값을 URL(?assignee=) 에 담아 뷰를 바꿔도 필터가 유지되고 링크 공유도 된다.
 */
export default function AssigneeFilter({
  members,
  value,
  counts,
}: {
  members: OrgMember[];
  value: string;
  counts: FilterCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selectedMember = members.find((m) => m.user_id === value);
  const label =
    value === ASSIGNEE_ALL
      ? "전체"
      : value === ASSIGNEE_NONE
        ? "담당자 없음"
        : (selectedMember?.profiles?.name ?? "?");
  const isFiltered = value !== ASSIGNEE_ALL;

  function pick(next: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (next === ASSIGNEE_ALL) params.delete("assignee");
    else params.set("assignee", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const rowCls =
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isFiltered
            ? "bg-sky-600 text-white hover:bg-sky-700"
            : "border border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
        title="담당자로 걸러 보기"
      >
        <span>👤</span>
        <span>{label}</span>
        {isFiltered && (
          <span
            role="button"
            tabIndex={0}
            aria-label="필터 해제"
            onClick={(e) => {
              e.stopPropagation();
              pick(ASSIGNEE_ALL);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                pick(ASSIGNEE_ALL);
              }
            }}
            className="ml-0.5 rounded-full px-1 text-white/80 hover:bg-white/25 hover:text-white"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">
              담당자로 보기
            </p>
            <ul className="max-h-72 overflow-y-auto p-1.5">
              <li>
                <button
                  onClick={() => pick(ASSIGNEE_ALL)}
                  className={`${rowCls} ${
                    value === ASSIGNEE_ALL
                      ? "bg-sky-50 font-medium text-sky-700"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                    全
                  </span>
                  <span className="flex-1">전체</span>
                  <span className="text-xs text-slate-400">{counts.all}</span>
                </button>
              </li>

              {members.map((m) => (
                <li key={m.user_id}>
                  <button
                    onClick={() => pick(m.user_id)}
                    className={`${rowCls} ${
                      value === m.user_id
                        ? "bg-sky-50 font-medium text-sky-700"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(m.user_id)}`}
                    >
                      {initial(m.profiles?.name ?? "")}
                    </span>
                    <span className="flex-1 truncate">{m.profiles?.name}</span>
                    <span className="text-xs text-slate-400">
                      {counts.byUser[m.user_id] ?? 0}
                    </span>
                  </button>
                </li>
              ))}

              <li>
                <button
                  onClick={() => pick(ASSIGNEE_NONE)}
                  className={`${rowCls} ${
                    value === ASSIGNEE_NONE
                      ? "bg-sky-50 font-medium text-sky-700"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-500">
                    ?
                  </span>
                  <span className="flex-1">담당자 없음</span>
                  <span className="text-xs text-slate-400">{counts.none}</span>
                </button>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
