"use client";

import { useState } from "react";
import { avatarColor, initial } from "@/lib/utils";
import type { Card, OrgMember } from "@/lib/types";

export const FILTER_ALL = "all";
export const FILTER_NONE = "none";

/** 카드가 현재 담당자 필터에 걸리는지 */
export function matchesAssigneeFilter(card: Card, filter: string): boolean {
  if (filter === FILTER_ALL) return true;
  if (filter === FILTER_NONE) return card.assigneeIds.length === 0;
  return card.assigneeIds.includes(filter);
}

export interface FilterCounts {
  all: number;
  none: number;
  byUser: Record<string, number>;
}

export default function BoardFilter({
  members,
  value,
  onChange,
  counts,
}: {
  members: OrgMember[];
  value: string;
  onChange: (value: string) => void;
  counts: FilterCounts;
}) {
  const [open, setOpen] = useState(false);

  const selectedMember = members.find((m) => m.user_id === value);
  const label =
    value === FILTER_ALL
      ? "전체"
      : value === FILTER_NONE
        ? "담당자 없음"
        : (selectedMember?.profiles?.name ?? "?");
  const isFiltered = value !== FILTER_ALL;

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  const rowCls =
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
          isFiltered
            ? "bg-sky-600 text-white hover:bg-sky-700"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              pick(FILTER_ALL);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                pick(FILTER_ALL);
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
          <div className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">
              담당자로 보기
            </p>
            <ul className="max-h-72 overflow-y-auto p-1.5">
              <li>
                <button
                  onClick={() => pick(FILTER_ALL)}
                  className={`${rowCls} ${
                    value === FILTER_ALL
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

              {members.map((m) => {
                const selected = value === m.user_id;
                return (
                  <li key={m.user_id}>
                    <button
                      onClick={() => pick(m.user_id)}
                      className={`${rowCls} ${
                        selected
                          ? "bg-sky-50 font-medium text-sky-700"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(m.user_id)}`}
                      >
                        {initial(m.profiles?.name ?? "")}
                      </span>
                      <span className="flex-1 truncate">
                        {m.profiles?.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {counts.byUser[m.user_id] ?? 0}
                      </span>
                    </button>
                  </li>
                );
              })}

              <li>
                <button
                  onClick={() => pick(FILTER_NONE)}
                  className={`${rowCls} ${
                    value === FILTER_NONE
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
