import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScopedCard } from "@/lib/types";

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
  scope: ViewScope
): Promise<{ activities: ReportActivity[]; counts: ReportCounts }> {
  const since = sevenDaysAgoIso();

  const applyScope = <Q,>(query: Q): Q => {
    const builder = query as unknown as {
      eq: (column: string, value: string) => unknown;
    };
    if (scope.boardId) return builder.eq("board_id", scope.boardId) as Q;
    if (scope.orgId) return builder.eq("boards.org_id", scope.orgId) as Q;
    return query;
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
