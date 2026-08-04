import Link from "next/link";
import {
  activityText,
  avatarColor,
  boardTheme,
  formatDate,
  initial,
  isOverdue,
  STATUS_LABELS,
  timeAgo,
} from "@/lib/utils";
import type { ScopedCard } from "@/lib/types";
import type { ReportActivity, ReportCounts } from "@/lib/view-data";

/** STATUS_HEADER_STYLES 와 같은 색 (slate-500 / blue-600 / emerald-600) */
const STATUS_CHART_COLORS: Record<string, string> = {
  ready: "#636369",
  in_progress: "#3b7dd8",
  done: "#2e8b57",
};

/** 다음 7일 내 마감(완료 제외) 카드 필터 */
function filterDueSoon(cards: ScopedCard[]): ScopedCard[] {
  const now = Date.now();
  return cards.filter((c) => {
    if (!c.due_date || c.status === "done") return false;
    const due = new Date(c.due_date + "T23:59:59").getTime();
    return due >= now && due <= now + 7 * 86400000;
  });
}

function StatCard({
  emoji,
  value,
  label,
  sub,
}: {
  emoji: string;
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-xl">
        {emoji}
      </span>
      <div>
        <p className="text-lg font-bold leading-6">
          {value}
          <span className="ml-1 text-sm font-semibold">{label}</span>
        </p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function Donut({ cards }: { cards: ScopedCard[] }) {
  const total = cards.length;
  const counts = {
    ready: cards.filter((c) => c.status === "ready").length,
    in_progress: cards.filter((c) => c.status === "in_progress").length,
    done: cards.filter((c) => c.status === "done").length,
  };
  const R = 48;
  const C = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = (["ready", "in_progress", "done"] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => {
      const frac = total > 0 ? counts[s] / total : 0;
      const seg = {
        status: s,
        dash: `${frac * C} ${C}`,
        offset: -cumulative * C,
      };
      cumulative += frac;
      return seg;
    });

  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <svg width="150" height="150" viewBox="0 0 120 120" role="img">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="14"
        />
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={STATUS_CHART_COLORS[seg.status]}
            strokeWidth="14"
            strokeDasharray={seg.dash}
            strokeDashoffset={seg.offset}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          className="fill-slate-800"
          fontSize="24"
          fontWeight="bold"
        >
          {total}
        </text>
        <text
          x="60"
          y="74"
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="10"
        >
          총 업무
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {(["ready", "in_progress", "done"] as const).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: STATUS_CHART_COLORS[s] }}
            />
            <span className="text-slate-600">
              {STATUS_LABELS[s]}: <strong>{counts[s]}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 보고서 대시보드 (조직/보드 공용) */
export default function ReportView({
  cards,
  activities,
  counts,
  namesById,
}: {
  cards: ScopedCard[];
  activities: ReportActivity[];
  counts: ReportCounts;
  namesById: Record<string, string>;
}) {
  const dueSoonCards = filterDueSoon(cards);

  // 팀 워크로드
  const workload = new Map<string, number>();
  let unassigned = 0;
  for (const card of cards) {
    if (card.card_assignees.length === 0) {
      unassigned++;
      continue;
    }
    for (const a of card.card_assignees) {
      workload.set(a.user_id, (workload.get(a.user_id) ?? 0) + 1);
    }
  }
  const workloadRows: { id: string | null; name: string; count: number }[] = [
    ...(unassigned > 0
      ? [{ id: null, name: "할당되지 않음", count: unassigned }]
      : []),
    ...[...workload.entries()]
      .map(([id, count]) => ({ id, name: namesById[id] ?? "?", count }))
      .sort((a, b) => b.count - a.count),
  ];
  const maxWorkload = Math.max(1, ...workloadRows.map((r) => r.count));

  // 보드별 진행률
  const boardMap = new Map<
    string,
    { title: string; color: string; total: number; done: number; inProgress: number }
  >();
  for (const card of cards) {
    let b = boardMap.get(card.board_id);
    if (!b) {
      b = {
        title: card.boards.title,
        color: card.boards.color,
        total: 0,
        done: 0,
        inProgress: 0,
      };
      boardMap.set(card.board_id, b);
    }
    b.total++;
    if (card.status === "done") b.done++;
    if (card.status === "in_progress") b.inProgress++;
  }
  const boardRows = [...boardMap.entries()].sort(
    (a, b) => b[1].total - a[1].total
  );

  const panelCls = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          emoji="✅"
          value={counts.done7}
          label="개 완료함"
          sub="지난 7일간"
        />
        <StatCard
          emoji="🔄"
          value={counts.updated7}
          label="개 업데이트함"
          sub="지난 7일간"
        />
        <StatCard
          emoji="🆕"
          value={counts.created7}
          label="개 만듦"
          sub="지난 7일간"
        />
        <StatCard
          emoji="⏰"
          value={dueSoonCards.length}
          label="개 마감 예정"
          sub="다음 7일 이내"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 상태 개요 */}
        <section className={panelCls}>
          <h2 className="mb-1 text-base font-bold">상태 개요</h2>
          <p className="mb-5 text-xs text-slate-400">
            업무 항목의 상태 스냅샷입니다.
          </p>
          {cards.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              업무가 없습니다.
            </p>
          ) : (
            <Donut cards={cards} />
          )}
        </section>

        {/* 최근 활동 */}
        <section className={panelCls}>
          <h2 className="mb-1 text-base font-bold">최근 활동</h2>
          <p className="mb-4 text-xs text-slate-400">
            전반에서 일어나는 최신 활동입니다.
          </p>
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {activities.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-400">
                최근 활동이 없습니다.
              </li>
            )}
            {activities.map((activity) => (
              <li key={activity.id} className="flex gap-2.5 text-sm">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(activity.actor_id ?? "")}`}
                >
                  {initial(activity.profiles?.name ?? "?")}
                </span>
                <div className="min-w-0">
                  <p className="leading-5 text-slate-600">
                    <span className="font-semibold">
                      {activity.profiles?.name ?? "알 수 없음"}
                    </span>{" "}
                    {activityText(activity.type, activity.data)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {activity.cards?.title && (
                      <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                        {activity.cards.title}
                      </span>
                    )}
                    {activity.boards?.title} · {timeAgo(activity.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 팀 워크로드 */}
        <section className={panelCls}>
          <h2 className="mb-1 text-base font-bold">팀 워크로드</h2>
          <p className="mb-4 text-xs text-slate-400">
            담당자별 업무 배분입니다.
          </p>
          <ul className="space-y-3">
            {workloadRows.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-400">
                업무가 없습니다.
              </li>
            )}
            {workloadRows.map((row) => (
              <li key={row.id ?? "unassigned"} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    row.id ? avatarColor(row.id) : "bg-slate-400"
                  }`}
                >
                  {row.id ? initial(row.name) : "?"}
                </span>
                <span className="w-24 shrink-0 truncate text-sm text-slate-600">
                  {row.name}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-slate-500"
                    style={{ width: `${(row.count / maxWorkload) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-500">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 보드별 진행률 */}
        <section className={panelCls}>
          <h2 className="mb-1 text-base font-bold">진행률</h2>
          <p className="mb-4 text-xs text-slate-400">
            <span className="mr-3 inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> 완료
            </span>
            <span className="mr-3 inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> 진행 중
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> 준비
            </span>
          </p>
          <ul className="space-y-4">
            {boardRows.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-400">
                보드가 없습니다.
              </li>
            )}
            {boardRows.map(([boardId, b]) => {
              const donePct = Math.round((b.done / b.total) * 100);
              return (
                <li key={boardId}>
                  <Link
                    href={`/board/${boardId}`}
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-sky-700 hover:underline"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded"
                      style={{ backgroundColor: boardTheme(b.color).tile }}
                    />
                    {b.title}
                    <span className="text-xs font-normal text-slate-400">
                      {b.done}/{b.total} · {donePct}%
                    </span>
                  </Link>
                  <div className="flex h-5 overflow-hidden rounded bg-slate-100">
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(b.done / b.total) * 100}%` }}
                    />
                    <div
                      className="bg-blue-500"
                      style={{ width: `${(b.inProgress / b.total) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* 마감 예정 목록 */}
      {dueSoonCards.length > 0 && (
        <section className={panelCls}>
          <h2 className="mb-4 text-base font-bold">
            ⏰ 다음 7일 마감 예정{" "}
            <span className="text-sm font-normal text-slate-400">
              {dueSoonCards.length}건
            </span>
          </h2>
          <ul className="divide-y divide-slate-50">
            {dueSoonCards
              .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
              .map((card) => (
                <li key={card.id}>
                  <Link
                    href={`/board/${card.board_id}?card=${card.id}`}
                    className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded"
                      style={{
                        backgroundColor: boardTheme(card.boards.color).tile,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {card.title}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {card.boards.title}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        isOverdue(card.due_date)
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {formatDate(card.due_date)}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
