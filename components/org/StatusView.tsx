import Link from "next/link";
import {
  avatarColor,
  boardColor,
  formatDate,
  initial,
  isOverdue,
  STATUS_HEADER_STYLES,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/utils";
import type { ScopedCard } from "@/lib/types";

/** 준비/진행/완료 3컬럼 상태별 보기 (조직/보드 공용) */
export default function StatusView({
  cards,
  namesById,
  showBoardName = true,
}: {
  cards: ScopedCard[];
  namesById: Record<string, string>;
  showBoardName?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {STATUS_ORDER.map((status) => {
        const statusCards = cards.filter((c) => c.status === status);
        return (
          <section
            key={status}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header
              className={`flex items-center justify-between rounded-t-xl px-4 py-2.5 text-white ${STATUS_HEADER_STYLES[status]}`}
            >
              <h2 className="text-sm font-bold">{STATUS_LABELS[status]}</h2>
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                {statusCards.length}
              </span>
            </header>
            <ul className="space-y-2 p-3">
              {statusCards.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400">
                  해당 상태의 업무가 없습니다.
                </li>
              )}
              {statusCards.map((card) => (
                <li key={card.id}>
                  <Link
                    href={`/board/${card.board_id}?card=${card.id}`}
                    className="block rounded-lg border border-slate-200 p-3 transition hover:border-sky-300 hover:shadow-sm"
                  >
                    {showBoardName && (
                      <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded ${boardColor(card.boards.color).tile}`}
                        />
                        {card.boards.title}
                      </p>
                    )}
                    <p className="text-sm font-medium text-slate-800">
                      {card.title}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {card.due_date && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            isOverdue(card.due_date) && status !== "done"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {formatDate(card.due_date)}
                        </span>
                      )}
                      <span className="flex-1" />
                      {card.card_assignees.slice(0, 4).map((a) => (
                        <span
                          key={a.user_id}
                          title={namesById[a.user_id]}
                          className={`-ml-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white ${avatarColor(a.user_id)}`}
                        >
                          {initial(namesById[a.user_id] ?? "?")}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
