import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgMember, ScopedCard } from "@/lib/types";
import { matchesAssignee } from "@/lib/utils";

/** 담당자 필터 적용 */
export function filterByAssignee(
  cards: ScopedCard[],
  filter: string
): ScopedCard[] {
  return cards.filter((c) =>
    matchesAssignee(
      c.card_assignees.map((a) => a.user_id),
      filter
    )
  );
}

/** 담당자별 카드 수 (필터 드롭다운에 표시) */
export function assigneeCounts(cards: ScopedCard[]) {
  const byUser: Record<string, number> = {};
  let none = 0;
  for (const card of cards) {
    if (card.card_assignees.length === 0) none++;
    for (const a of card.card_assignees) {
      byUser[a.user_id] = (byUser[a.user_id] ?? 0) + 1;
    }
  }
  return { all: cards.length, none, byUser };
}

export interface ViewScope {
  orgId?: string;
  boardId?: string;
}

/** 조직 또는 보드 범위의 카드 목록 (보드 정보 포함) */
export async function fetchScopedCards(
  supabase: SupabaseClient,
  scope: ViewScope
): Promise<ScopedCard[]> {
  let query = supabase
    .from("cards")
    .select(
      "id, title, status, due_date, start_at, end_at, board_id, list_id, created_at, card_assignees(user_id), boards!inner(id, title, color, org_id)"
    );
  if (scope.boardId) {
    query = query.eq("board_id", scope.boardId);
  } else if (scope.orgId) {
    query = query.eq("boards.org_id", scope.orgId);
  }
  const { data } = await query.order("created_at", { ascending: true });
  return (data ?? []) as unknown as ScopedCard[];
}

/** 조직 멤버 목록 (담당자 필터·아바타 표시용) */
export async function fetchOrgMembers(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgMember[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("*, profiles(id, email, name)")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true });
  return (data ?? []) as unknown as OrgMember[];
}

/** 범위 내 멤버 이름 매핑 (user_id -> name) */
export async function fetchMemberNames(
  supabase: SupabaseClient,
  orgId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, profiles(name)")
    .eq("org_id", orgId);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as {
    user_id: string;
    profiles: { name: string } | null;
  }[]) {
    map[row.user_id] = row.profiles?.name ?? "?";
  }
  return map;
}

export interface BoardContext {
  id: string;
  title: string;
  color: string;
  org_id: string;
  orgName: string;
}

/** 보드 하위 페이지용 보드+조직 정보 */
export async function fetchBoardContext(
  supabase: SupabaseClient,
  boardId: string
): Promise<BoardContext | null> {
  const { data } = await supabase
    .from("boards")
    .select("id, title, color, org_id, organizations(name)")
    .eq("id", boardId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    title: string;
    color: string;
    org_id: string;
    organizations: { name: string } | null;
  };
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    org_id: row.org_id,
    orgName: row.organizations?.name ?? "",
  };
}

export interface ReportActivity {
  id: number;
  type: string;
  data: Record<string, string | null>;
  created_at: string;
  actor_id: string | null;
  profiles: { name: string } | null;
  cards: { title: string } | null;
  boards: { title: string } | null;
}

export interface ReportCounts {
  done7: number;
  created7: number;
  updated7: number;
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/** 보고서용 최근 활동 + 최근 7일 집계 */
export async function fetchReportData(
  supabase: SupabaseClient,
  scope: ViewScope,
  /** 담당자 필터가 걸린 경우, 그 담당자의 카드 id 목록으로 활동도 제한한다 */
  cardIds?: string[] | null
): Promise<{ activities: ReportActivity[]; counts: ReportCounts }> {
  const since = sevenDaysAgoIso();

  // 필터 결과가 0건이면 활동도 0건 (빈 in() 은 조건이 무시되므로 미리 처리)
  if (cardIds && cardIds.length === 0) {
    return {
      activities: [],
      counts: { done7: 0, created7: 0, updated7: 0 },
    };
  }

  const applyScope = <Q,>(query: Q): Q => {
    const builder = query as unknown as {
      eq: (column: string, value: string) => unknown;
      in: (column: string, values: string[]) => unknown;
    };
    let out: unknown = query;
    if (scope.boardId) out = builder.eq("board_id", scope.boardId);
    else if (scope.orgId) out = builder.eq("boards.org_id", scope.orgId);
    if (cardIds) {
      out = (out as { in: (c: string, v: string[]) => unknown }).in(
        "card_id",
        cardIds
      );
    }
    return out as Q;
  };

  const [feedRes, doneRes, createdRes, updatedRes] = await Promise.all([
    applyScope(
      supabase
        .from("activities")
        .select(
          "id, type, data, created_at, actor_id, profiles(name), cards(title), boards!inner(title, org_id)"
        )
    )
      .order("created_at", { ascending: false })
      .limit(15),
    applyScope(
      supabase
        .from("activities")
        .select("id, boards!inner(org_id)", { count: "exact", head: true })
        .eq("type", "status_changed")
        .eq("data->>to", "done")
        .gte("created_at", since)
    ),
    applyScope(
      supabase
        .from("activities")
        .select("id, boards!inner(org_id)", { count: "exact", head: true })
        .eq("type", "card_created")
        .gte("created_at", since)
    ),
    applyScope(
      supabase
        .from("activities")
        .select("id, boards!inner(org_id)", { count: "exact", head: true })
        .gte("created_at", since)
    ),
  ]);

  return {
    activities: (feedRes.data ?? []) as unknown as ReportActivity[],
    counts: {
      done7: doneRes.count ?? 0,
      created7: createdRes.count ?? 0,
      updated7: updatedRes.count ?? 0,
    },
  };
}
