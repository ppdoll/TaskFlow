"use client";

import { useState } from "react";
import {
  ASSIGNEE_NONE,
  assigneeFilterLabel,
  avatarColor,
  initial,
} from "@/lib/utils";
import type { OrgMember } from "@/lib/types";

export interface FilterCounts {
  all: number;
  none: number;
  byUser: Record<string, number>;
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
        on
          ? "border-sky-600 bg-sky-600 text-white"
          : "border-slate-300 bg-white text-transparent"
      }`}
    >
      ✓
    </span>
  );
}

/**
 * 담당자 복수 선택 드롭다운 (표시 전용).
 * 선택한 사람 중 한 명이라도 맡은 카드를 보여준다(OR).
 * 칸반(로컬 상태)과 나머지 뷰(URL 파라미터)가 함께 쓴다.
 */
export default function AssigneeFilterMenu({
  members,
  selected,
  counts,
  onToggle,
  onClear,
  align = "left",
  size = "sm",
}: {
  members: OrgMember[];
  selected: string[];
  counts: FilterCounts;
  onToggle: (id: string) => void;
  onClear: () => void;
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  const nameOf = (id: string) =>
    members.find((m) => m.user_id === id)?.profiles?.name ?? "?";
  const label = assigneeFilterLabel(selected, nameOf);
  const isFiltered = selected.length > 0;

  const rowCls =
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg font-medium transition ${
          size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-sm"
        } ${
          isFiltered
            ? "bg-sky-600 text-white hover:bg-sky-700"
            : size === "md"
              ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
        title="담당자로 걸러 보기 (여러 명 선택 가능)"
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
              onClear();
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClear();
                setOpen(false);
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
          <div
            className={`absolute top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-500">
                담당자로 보기{" "}
                <span className="font-normal text-slate-400">(중복 선택)</span>
              </p>
              {isFiltered && (
                <button
                  onClick={onClear}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  전체
                </button>
              )}
            </div>

            <ul className="max-h-72 overflow-y-auto p-1.5">
              <li>
                <button
                  onClick={onClear}
                  className={`${rowCls} ${
                    !isFiltered
                      ? "bg-sky-50 font-medium text-sky-700"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <Check on={!isFiltered} />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                    全
                  </span>
                  <span className="flex-1">전체</span>
                  <span className="text-xs text-slate-400">{counts.all}</span>
                </button>
              </li>

              {members.map((m) => {
                const on = selected.includes(m.user_id);
                return (
                  <li key={m.user_id}>
                    <button
                      onClick={() => onToggle(m.user_id)}
                      className={`${rowCls} ${
                        on
                          ? "bg-sky-50 font-medium text-sky-700"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <Check on={on} />
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
                  onClick={() => onToggle(ASSIGNEE_NONE)}
                  className={`${rowCls} ${
                    selected.includes(ASSIGNEE_NONE)
                      ? "bg-sky-50 font-medium text-sky-700"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <Check on={selected.includes(ASSIGNEE_NONE)} />
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
