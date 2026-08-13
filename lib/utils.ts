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

/* ============================================================
   보드 테마 색상
   boards.color 에는 프리셋 키("ocean") 또는 임의의 HEX("#0F4C81") 가 저장된다.
   어떤 색이 들어와도 읽히도록 배경 틴트와 글자색을 명도에서 계산한다.
   ============================================================ */

export interface BoardPreset {
  key: string;
  name: string;
  tile: string;
}

/** 첨부된 컬러 팔레트를 기반으로 한 보드 테마 프리셋 */
export const BOARD_PRESETS: BoardPreset[] = [
  { key: "ocean", name: "오션 브리즈", tile: "#0F4C81" },
  { key: "tropical", name: "트로피컬", tile: "#157E8C" },
  { key: "earth", name: "어스 & 네이처", tile: "#606C38" },
  { key: "autumn", name: "웜 어텀", tile: "#A44A3F" },
  { key: "sunset", name: "선셋 글로우", tile: "#C0503F" },
  { key: "royal", name: "로열 엘레강스", tile: "#C21230" },
  { key: "pastel", name: "소프트 파스텔", tile: "#A8607A" },
  { key: "neon", name: "사이버 네온", tile: "#8B4BD6" },
  { key: "luxury", name: "모던 럭셔리", tile: "#1F2937" },
  { key: "mono", name: "미니멀 모노", tile: "#3A3A3A" },
];

/** 초기 버전에서 쓰던 색 키 (기존 보드 호환용) */
const LEGACY_BOARD_COLORS: Record<string, string> = {
  sky: "#0B72D8",
  emerald: "#277A4C",
  violet: "#6A5FC4",
  rose: "#BC4763",
  amber: "#96701A",
  slate: "#48484D",
};

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  const p = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** WCAG 상대 휘도 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastWith(lum: number, other: number): number {
  const [hi, lo] = lum > other ? [lum, other] : [other, lum];
  return (hi + 0.05) / (lo + 0.05);
}

/** 흰색과 비율만큼 섞는다 (amount = 흰색 비중) */
function mixWhite(rgb: [number, number, number], amount: number) {
  return rgb.map((c) => c + (255 - c) * amount) as [number, number, number];
}

export interface BoardTheme {
  /** 보드 타일·간트 막대·캘린더 칩 등 솔리드 색 */
  tile: string;
  /** 보드 캔버스 배경 (아주 연한 틴트) */
  surface: string;
  /** tile 위에 올릴 글자색 — 대비가 높은 쪽으로 자동 선택 */
  onTile: string;
}

/** boards.color 값을 실제 색으로 해석한다 (프리셋 키 / HEX / 레거시 키 모두 허용) */
export function boardTheme(color: string | null | undefined): BoardTheme {
  const raw = (color ?? "").trim();
  const hex = isHexColor(raw)
    ? raw
    : (BOARD_PRESETS.find((p) => p.key === raw)?.tile ??
      LEGACY_BOARD_COLORS[raw] ??
      BOARD_PRESETS[0].tile);

  const rgb = hexToRgb(hex);
  const lum = relativeLuminance(rgb);

  // 밝은 색을 고르면 흰 글씨가 안 보이므로 대비가 높은 쪽을 쓴다
  const onTile =
    contrastWith(lum, 1) >= contrastWith(lum, 0) ? "#ffffff" : "#1c1c1e";

  // 아주 밝은 색은 틴트를 덜 섞어야 배경이 흰색과 구분된다
  const surfaceMix = lum > 0.6 ? 0.72 : 0.93;

  return {
    tile: hex,
    surface: toHex(mixWhite(rgb, surfaceMix)),
    onTile,
  };
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

/* ---------------- 담당자 필터 ---------------- */

export const ASSIGNEE_ALL = "all";
export const ASSIGNEE_NONE = "none";

/** 담당자 목록이 현재 필터에 걸리는지 */
export function matchesAssignee(
  assigneeIds: string[],
  filter: string
): boolean {
  if (!filter || filter === ASSIGNEE_ALL) return true;
  if (filter === ASSIGNEE_NONE) return assigneeIds.length === 0;
  return assigneeIds.includes(filter);
}

/** URL 파라미터 값을 안전한 필터 값으로 정규화 */
export function normalizeAssigneeFilter(
  value: string | undefined,
  memberIds: string[]
): string {
  if (!value) return ASSIGNEE_ALL;
  if (value === ASSIGNEE_NONE) return ASSIGNEE_NONE;
  return memberIds.includes(value) ? value : ASSIGNEE_ALL;
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
