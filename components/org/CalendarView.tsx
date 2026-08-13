"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { boardTheme, STATUS_LABELS, STATUS_ORDER } from "@/lib/utils";
import type { ScopedCard } from "@/lib/types";

const MS_DAY = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getToday(): Date {
  return startOfDay(new Date());
}

/** 카드가 캘린더에서 차지하는 날짜 범위 (없으면 null) */
function cardRange(card: ScopedCard): { from: Date; to: Date } | null {
  if (card.start_at) {
    const from = startOfDay(new Date(card.start_at));
    const to = card.end_at ? startOfDay(new Date(card.end_at)) : from;
    return { from, to: to < from ? from : to };
  }
  if (card.due_date) {
    const d = startOfDay(new Date(card.due_date + "T00:00:00"));
    return { from: d, to: d };
  }
  return null;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarView({ cards }: { cards: ScopedCard[] }) {
  const [today] = useState(getToday);
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 담당자 필터는 상위(URL 파라미터)에서 이미 적용되어 넘어온다
  const filtered = useMemo(
    () =>
      cards.filter(
        (c) => statusFilter === "all" || c.status === statusFilter
      ),
    [cards, statusFilter]
  );

  // 월 그리드: 해당 월 1일이 속한 주의 일요일부터, 말일이 속한 주의 토요일까지
  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const gridStart = new Date(first.getTime() - first.getDay() * MS_DAY);
    const gridEnd = new Date(last.getTime() + (6 - last.getDay()) * MS_DAY);

    const result: { date: Date; cards: ScopedCard[] }[][] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      const week: { date: Date; cards: ScopedCard[] }[] = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(cursor.getTime() + i * MS_DAY);
        const dayCards = filtered.filter((c) => {
          const range = cardRange(c);
          return range && range.from <= day && day <= range.to;
        });
        week.push({ date: day, cards: dayCards });
      }
      result.push(week);
      cursor = new Date(cursor.getTime() + 7 * MS_DAY);
    }
    return result;
  }, [month, filtered]);

  const unplaced = filtered.filter((c) => !cardRange(c)).length;

  function moveMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setExpanded(new Set());
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* 필터 + 월 이동 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">상태 전체</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <span className="flex-1" />

        <button
          onClick={() => {
            setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            setExpanded(new Set());
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          오늘
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white">
          <button
            onClick={() => moveMonth(-1)}
            className="px-3 py-1.5 text-slate-500 hover:text-sky-600"
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="min-w-28 text-center text-sm font-bold">
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </span>
          <button
            onClick={() => moveMonth(1)}
            className="px-3 py-1.5 text-slate-500 hover:text-sky-600"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-bold ${
                  i === 0
                    ? "text-red-600"
                    : i === 6
                      ? "text-blue-600"
                      : "text-slate-500"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100"
            >
              {week.map(({ date, cards: dayCards }) => {
                const key = dateKey(date);
                const inMonth = date.getMonth() === month.getMonth();
                const isToday = date.getTime() === today.getTime();
                const isExpanded = expanded.has(key);
                const visible = isExpanded ? dayCards : dayCards.slice(0, 3);
                const hidden = dayCards.length - visible.length;

                return (
                  <div
                    key={key}
                    className={`min-h-24 p-1.5 ${inMonth ? "" : "bg-slate-50/70"}`}
                  >
                    <p
                      className={`mb-1 text-right text-xs ${
                        isToday
                          ? "font-bold"
                          : inMonth
                            ? "text-slate-500"
                            : "text-slate-400"
                      }`}
                    >
                      <span
                        className={
                          isToday
                            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white"
                            : ""
                        }
                      >
                        {date.getDate()}
                      </span>
                    </p>
                    <div className="space-y-1">
                      {visible.map((card) => {
                        const t = boardTheme(card.boards.color);
                        return (
                          <Link
                            key={card.id}
                            href={`/board/${card.board_id}?card=${card.id}`}
                            title={`${card.boards.title} · ${card.title} (${STATUS_LABELS[card.status] ?? card.status})`}
                            style={{
                              backgroundColor: t.tile,
                              color: t.onTile,
                            }}
                            className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:opacity-80 ${
                              card.status === "done"
                                ? "opacity-50 line-through"
                                : ""
                            }`}
                          >
                            {card.title}
                          </Link>
                        );
                      })}
                      {hidden > 0 && (
                        <button
                          onClick={() => toggleExpand(key)}
                          className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-sky-600"
                        >
                          +{hidden}개 더 보기
                        </button>
                      )}
                      {isExpanded && dayCards.length > 3 && (
                        <button
                          onClick={() => toggleExpand(key)}
                          className="w-full rounded px-1.5 py-0.5 text-left text-[11px] text-slate-400 hover:bg-slate-100"
                        >
                          접기
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        시작~종료 시간(없으면 마감일) 기준으로 표시됩니다. 항목을 클릭하면 해당
        카드가 열립니다.
        {unplaced > 0 &&
          ` 날짜가 없는 업무 ${unplaced}건은 표시되지 않습니다 — 타임라인의 '날짜 미지정 업무'에서 지정할 수 있습니다.`}
      </p>
    </div>
  );
}
