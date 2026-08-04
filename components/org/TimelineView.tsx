"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  boardTheme,
  runQuery,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/utils";

export interface TimelineCard {
  id: string;
  title: string;
  status: string;
  start_at: string | null;
  end_at: string | null;
  board_id: string;
  boards: { id: string; title: string; color: string };
}

const DAY_W = 36; // 하루당 픽셀
const LABEL_W = 220; // 왼쪽 라벨 컬럼 너비
const MS_DAY = 86400000;

interface TimelineModel {
  days: { key: string; label: string; isWeekend: boolean; isToday: boolean }[];
  months: { label: string; span: number }[];
  boards: {
    id: string;
    title: string;
    color: string;
    rows: {
      card: TimelineCard;
      left: number;
      width: number;
      ongoing: boolean;
    }[];
  }[];
  todayLeft: number;
}

/** 타임라인 렌더링 좌표 계산 */
function buildTimeline(cards: TimelineCard[]): TimelineModel | null {
  const scheduled = cards
    .filter((c) => c.start_at)
    .sort((a, b) => a.start_at!.localeCompare(b.start_at!));
  if (scheduled.length === 0) return null;

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // 좌표는 '일' 단위로만 의미가 있으므로 오늘 0시로 맞춘다.
  // (서버와 브라우저가 각자 현재 시각을 계산하면 hydration 이 어긋난다)
  const today = startOfDay(new Date());
  // 종료 시간이 없는 카드는 오늘 끝까지 이어지는 것으로 본다
  const openEnd = today.getTime() + MS_DAY;

  const starts = scheduled.map((c) => new Date(c.start_at!).getTime());
  const ends = scheduled.map((c) =>
    Math.max(
      c.end_at ? new Date(c.end_at).getTime() : openEnd,
      new Date(c.start_at!).getTime()
    )
  );

  const rangeStart = startOfDay(new Date(Math.min(...starts) - MS_DAY));
  const rangeEnd = startOfDay(
    new Date(Math.max(...ends, today.getTime()) + 2 * MS_DAY)
  );
  const totalDays =
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / MS_DAY) + 1;

  const days: TimelineModel["days"] = [];
  const months: TimelineModel["months"] = [];
  const todayKey = today.getTime();
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart.getTime() + i * MS_DAY);
    days.push({
      key: d.toISOString(),
      label: String(d.getDate()),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: startOfDay(d).getTime() === todayKey,
    });
    const monthLabel = `${d.getFullYear()}. ${d.getMonth() + 1}.`;
    const last = months[months.length - 1];
    if (last && last.label === monthLabel) last.span += 1;
    else months.push({ label: monthLabel, span: 1 });
  }

  const toX = (t: number) => ((t - rangeStart.getTime()) / MS_DAY) * DAY_W;

  const byBoard = new Map<string, TimelineModel["boards"][number]>();
  for (const card of scheduled) {
    const start = new Date(card.start_at!).getTime();
    const end = Math.max(
      card.end_at ? new Date(card.end_at).getTime() : openEnd,
      start + MS_DAY / 4
    );
    let group = byBoard.get(card.board_id);
    if (!group) {
      group = {
        id: card.boards.id,
        title: card.boards.title,
        color: card.boards.color,
        rows: [],
      };
      byBoard.set(card.board_id, group);
    }
    group.rows.push({
      card,
      left: toX(start),
      width: Math.max(toX(end) - toX(start), 14),
      ongoing: !card.end_at,
    });
  }

  return {
    days,
    months,
    boards: [...byBoard.values()],
    // 오늘 칸의 가운데에 선을 긋는다
    todayLeft: toX(today.getTime() + MS_DAY / 2),
  };
}

function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** 날짜 미지정 카드 한 줄 (인라인 날짜 지정) */
function UnscheduledRow({
  card,
  onSchedule,
}: {
  card: TimelineCard;
  onSchedule: (cardId: string, startAt: string, endAt: string | null) => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  function apply() {
    if (!start) return;
    const startIso = toIso(start)!;
    const endIso = toIso(end);
    if (endIso && endIso < startIso) {
      alert("종료 시간이 시작 시간보다 빠릅니다.");
      return;
    }
    onSchedule(card.id, startIso, endIso);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded"
        style={{ backgroundColor: boardTheme(card.boards.color).tile }}
        title={card.boards.title}
      />
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-xs text-slate-400">{card.boards.title}</p>
        <Link
          href={`/board/${card.board_id}?card=${card.id}`}
          className="block truncate text-sm font-medium text-slate-700 hover:text-sky-700 hover:underline"
        >
          {card.title}
        </Link>
      </div>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[card.status] ?? ""}`}
      >
        {STATUS_LABELS[card.status] ?? card.status}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
          aria-label="시작 시간"
        />
        <span className="text-xs text-slate-400">~</span>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
          aria-label="종료 시간 (선택)"
        />
        <button
          onClick={apply}
          disabled={!start}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
        >
          지정
        </button>
      </div>
    </li>
  );
}

export default function TimelineView({
  initialCards,
}: {
  initialCards: TimelineCard[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<TimelineCard[]>(initialCards);
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);

  const unscheduled = cards.filter((c) => !c.start_at);
  const model = useMemo(() => buildTimeline(cards), [cards]);
  const trackW = model ? model.days.length * DAY_W : 0;

  function handleSchedule(
    cardId: string,
    startAt: string,
    endAt: string | null
  ) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, start_at: startAt, end_at: endAt } : c
      )
    );
    runQuery(
      supabase
        .from("cards")
        .update({ start_at: startAt, end_at: endAt })
        .eq("id", cardId)
    );
  }

  return (
    <div className="space-y-6">
      {/* 날짜 미지정 업무 (접이식) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          onClick={() => setUnscheduledOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-t-xl px-4 py-3 text-left transition hover:bg-slate-50"
        >
          <span
            className={`text-xs text-slate-400 transition-transform ${unscheduledOpen ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <h2 className="text-sm font-bold text-slate-700">
            📋 날짜 미지정 업무
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {unscheduled.length}
          </span>
          <span className="flex-1" />
          <span className="text-xs text-slate-400">
            {unscheduledOpen ? "접기" : "펼치기"}
          </span>
        </button>

        {unscheduledOpen && (
          <div className="border-t border-slate-100">
            {unscheduled.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                모든 업무에 날짜가 지정되어 있습니다. 👍
              </p>
            ) : (
              <>
                <p className="border-b border-slate-50 px-4 py-2 text-xs text-slate-400">
                  시작 시간을 입력하고 <strong>지정</strong>을 누르면 바로
                  타임라인에 표시됩니다. (종료 시간은 선택)
                </p>
                <ul className="divide-y divide-slate-50">
                  {unscheduled.map((card) => (
                    <UnscheduledRow
                      key={card.id}
                      card={card}
                      onSchedule={handleSchedule}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {/* 타임라인 차트 */}
      {!model ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <p className="text-lg font-medium">표시할 작업 기간이 없습니다.</p>
          <p className="mt-2 text-sm">
            위 목록에서 날짜를 지정하거나, 카드 상태를 <strong>진행</strong>
            으로 바꾸면 (시작 시간 자동 기록) 타임라인이 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div style={{ width: LABEL_W + trackW }}>
              {/* 월 헤더 */}
              <div className="flex border-b border-slate-100">
                <div
                  className="shrink-0 border-r border-slate-100"
                  style={{ width: LABEL_W }}
                />
                {model.months.map((m, i) => (
                  <div
                    key={i}
                    className="border-r border-slate-100 px-2 py-1 text-xs font-semibold text-slate-500"
                    style={{ width: m.span * DAY_W }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* 일 헤더 */}
              <div className="flex border-b border-slate-200">
                <div
                  className="shrink-0 border-r border-slate-100 px-3 py-1 text-xs font-semibold text-slate-400"
                  style={{ width: LABEL_W }}
                >
                  업무
                </div>
                {model.days.map((d) => (
                  <div
                    key={d.key}
                    className={`shrink-0 py-1 text-center text-[11px] ${
                      d.isToday
                        ? "bg-red-50 font-bold text-red-600"
                        : d.isWeekend
                          ? "bg-slate-50 text-slate-400"
                          : "text-slate-400"
                    }`}
                    style={{ width: DAY_W }}
                  >
                    {d.label}
                  </div>
                ))}
              </div>

              {/* 보드별 행 */}
              {model.boards.map((group) => (
                <div key={group.id}>
                  <div className="flex border-b border-slate-100 bg-slate-50/60">
                    <div
                      className="flex shrink-0 items-center gap-1.5 border-r border-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                      style={{ width: LABEL_W }}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded"
                        style={{ backgroundColor: boardTheme(group.color).tile }}
                      />
                      {group.title}
                    </div>
                    <div style={{ width: trackW }} />
                  </div>

                  {group.rows.map(({ card, left, width, ongoing }) => (
                    <div
                      key={card.id}
                      className="flex border-b border-slate-50"
                    >
                      <div
                        className="shrink-0 truncate border-r border-slate-100 px-3 py-2 text-sm text-slate-700"
                        style={{ width: LABEL_W }}
                        title={card.title}
                      >
                        {card.title}
                      </div>
                      <div
                        className="relative shrink-0"
                        style={{ width: trackW, height: 36 }}
                      >
                        {model.days.map(
                          (d, i) =>
                            d.isWeekend && (
                              <span
                                key={d.key}
                                className="absolute inset-y-0 bg-slate-50"
                                style={{ left: i * DAY_W, width: DAY_W }}
                              />
                            )
                        )}
                        <span
                          className="absolute inset-y-0 w-px bg-red-400"
                          style={{ left: model.todayLeft }}
                        />
                        <Link
                          href={`/board/${card.board_id}?card=${card.id}`}
                          className={`absolute top-1.5 flex h-6 items-center truncate rounded-md px-2 text-[11px] font-semibold shadow-sm transition hover:opacity-85 ${
                            card.status === "done" ? "opacity-60" : ""
                          } ${ongoing ? "rounded-r-none border-r-2 border-dashed border-white/70" : ""}`}
                          style={{
                            left,
                            width,
                            backgroundColor: boardTheme(group.color).tile,
                            color: boardTheme(group.color).onTile,
                          }}
                          title={`${card.title} (${STATUS_LABELS[card.status] ?? card.status}${ongoing ? " · 진행 중" : ""})`}
                        >
                          {card.title}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            막대를 클릭하면 해당 카드가 열립니다. 종료 시간이 없는 카드는
            오늘까지 이어지는 것으로 표시됩니다 (점선 끝). 완료된 업무는 흐리게
            표시됩니다.
          </p>
        </>
      )}
    </div>
  );
}
