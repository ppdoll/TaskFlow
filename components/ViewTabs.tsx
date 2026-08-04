import Link from "next/link";

export type ViewKey = "main" | "status" | "timeline" | "calendar" | "report";

const VIEWS: { key: ViewKey; suffix: string; orgLabel: string; boardLabel: string }[] = [
  { key: "main", suffix: "", orgLabel: "📁 보드 목록", boardLabel: "📋 칸반 보드" },
  { key: "status", suffix: "/status", orgLabel: "📊 상태별", boardLabel: "📊 상태별" },
  { key: "timeline", suffix: "/timeline", orgLabel: "📅 타임라인", boardLabel: "📅 타임라인" },
  { key: "calendar", suffix: "/calendar", orgLabel: "🗓️ 캘린더", boardLabel: "🗓️ 캘린더" },
  { key: "report", suffix: "/report", orgLabel: "📈 보고서", boardLabel: "📈 보고서" },
];

/** 조직/보드 하위 뷰 전환 탭 */
export default function ViewTabs({
  base,
  type,
  active,
}: {
  /** 예: /orgs/abc 또는 /board/xyz */
  base: string;
  type: "org" | "board";
  active: ViewKey;
}) {
  return (
    <nav className="flex flex-wrap gap-0.5 rounded-xl bg-slate-100 p-0.5">
      {VIEWS.map((view) => {
        const isActive = view.key === active;
        return (
          <Link
            key={view.key}
            href={`${base}${view.suffix}`}
            className={`rounded-[0.625rem] px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {type === "org" ? view.orgLabel : view.boardLabel}
          </Link>
        );
      })}
    </nav>
  );
}
