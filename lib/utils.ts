/**
 * supabase-js 쿼리 빌더는 await 또는 .then() 이 호출되는 시점에야 실제로 실행된다.
 * 결과를 기다릴 필요가 없는 쓰기 요청은 반드시 이 헬퍼로 감싸 실행을 강제한다.
 * (bare `void query;` 는 요청 자체가 전송되지 않음!)
 */
export function runQuery(query: PromiseLike<{ error: unknown }>): void {
  Promise.resolve(query).then(
    (res) => {
      if (res?.error) console.error("[supabase]", res.error);
    },
    (err) => console.error("[supabase]", err)
  );
}

/** 드래그&드롭 정렬용 fractional position 계산 */
export const POSITION_GAP = 65536;

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return POSITION_GAP;
  if (before === undefined) return after! / 2;
  if (after === undefined) return before + POSITION_GAP;
  return (before + after) / 2;
}

export function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return POSITION_GAP;
  return Math.max(...items.map((i) => i.position)) + POSITION_GAP;
}

/**
 * 보드 테마 색상
 * - surface: 보드 캔버스 배경 (연한 틴트 — 눈부심 없이 보드를 구분)
 * - tile: 보드 타일·간트 막대·캘린더 칩 등 흰 글씨가 올라가는 솔리드 색
 */
export const BOARD_COLORS: Record<string, { surface: string; tile: string }> = {
  sky: { surface: "bg-board-sky", tile: "bg-sky-600" },
  emerald: { surface: "bg-board-emerald", tile: "bg-emerald-600" },
  violet: { surface: "bg-board-violet", tile: "bg-violet-600" },
  rose: { surface: "bg-board-rose", tile: "bg-rose-500" },
  amber: { surface: "bg-board-amber", tile: "bg-amber-500" },
  slate: { surface: "bg-board-slate", tile: "bg-slate-600" },
};

export const BOARD_COLOR_KEYS = Object.keys(BOARD_COLORS);

export function boardColor(color: string) {
  return BOARD_COLORS[color] ?? BOARD_COLORS.sky;
}

/** 라벨 색상 (흰 글씨가 올라가므로 대비 확보된 톤) */
export const LABEL_COLORS: Record<string, string> = {
  green: "bg-label-green",
  yellow: "bg-label-yellow",
  orange: "bg-label-orange",
  red: "bg-label-red",
  purple: "bg-label-purple",
  blue: "bg-label-blue",
  sky: "bg-label-sky",
  pink: "bg-label-pink",
  gray: "bg-label-gray",
};

export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLORS);

export function labelColor(color: string) {
  return LABEL_COLORS[color] ?? LABEL_COLORS.gray;
}

/** 아바타 배경색 (사용자 id 기반 고정) */
const AVATAR_COLORS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
  "bg-avatar-8",
  "bg-avatar-9",
  "bg-avatar-10",
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initial(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

/** 날짜 포맷 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hh}:${mm}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatDate(iso);
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate + "T00:00:00") < today;
}

/** 역할 한글 표기 */
export const ROLE_LABELS: Record<string, string> = {
  owner: "조직장",
  admin: "관리자",
  member: "멤버",
};

/** 카드 상태 */
export const STATUS_ORDER = ["ready", "in_progress", "done"] as const;

export const STATUS_LABELS: Record<string, string> = {
  ready: "준비",
  in_progress: "진행",
  done: "완료",
};

/** 상태 칩 스타일 */
export const STATUS_STYLES: Record<string, string> = {
  ready: "bg-slate-200 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};

/** 상태별 보기 컬럼 헤더 색 */
export const STATUS_HEADER_STYLES: Record<string, string> = {
  ready: "bg-slate-500",
  in_progress: "bg-blue-600",
  done: "bg-emerald-600",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** 활동 로그 문구 */
export function activityText(
  type: string,
  data: Record<string, string | null>
): string {
  switch (type) {
    case "card_created":
      return "카드를 생성했습니다.";
    case "card_moved":
      return `카드를 '${data.from}' 에서 '${data.to}' (으)로 이동했습니다.`;
    case "due_date_changed":
      return data.due_date
        ? `마감일을 ${formatDate(data.due_date)} 로 설정했습니다.`
        : "마감일을 제거했습니다.";
    case "assignee_added":
      return `${data.user_name} 님을 담당자로 지정했습니다.`;
    case "assignee_removed":
      return `${data.user_name} 님을 담당자에서 제외했습니다.`;
    case "attachment_added":
      return data.attachment_type === "link"
        ? `'${data.name}' 링크를 첨부했습니다.`
        : `'${data.name}' 파일을 첨부했습니다.`;
    case "status_changed":
      return `상태를 '${statusLabel(data.from ?? "?")}' 에서 '${statusLabel(data.to ?? "?")}' (으)로 변경했습니다.`;
    default:
      return type;
  }
}
