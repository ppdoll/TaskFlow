import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import BoardCanvas from "@/components/board/BoardCanvas";
import { parseAssigneeParam } from "@/lib/utils";
import type { Card, Label, List, OrgMember } from "@/lib/types";

interface RawCard {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  due_date: string | null;
  status: "ready" | "in_progress" | "done";
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  card_assignees: { user_id: string }[];
  card_labels: { label_id: string }[];
  attachments: { count: number }[];
}

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ card?: string; assignee?: string }>;
}) {
  const [{ boardId }, { card: initialCardId, assignee }] = await Promise.all([
    params,
    searchParams,
  ]);
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  // 멤버는 board.org_id 가 있어야 조회할 수 있어 예전엔 왕복이 2번이었다.
  // 조직에 중첩해서 함께 받아오면 나머지와 같이 한 번에 끝난다.
  const [{ data: board }, { data: lists }, { data: rawCards }, { data: labels }] =
    await Promise.all([
      supabase
        .from("boards")
        .select(
          "*, organizations(id, name, organization_members(*, profiles(id, email, name)))"
        )
        .eq("id", boardId)
        .maybeSingle(),
      supabase
        .from("lists")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true }),
      supabase
        .from("cards")
        .select(
          "*, card_assignees(user_id), card_labels(label_id), attachments(count)"
        )
        .eq("board_id", boardId)
        .order("position", { ascending: true }),
      supabase
        .from("labels")
        .select("*")
        .eq("board_id", boardId)
        .order("name", { ascending: true }),
    ]);

  if (!board) notFound();

  const members = [
    ...((board.organizations?.organization_members ?? []) as OrgMember[]),
  ].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  const cards: Card[] = ((rawCards ?? []) as unknown as RawCard[]).map(
    ({ card_assignees, card_labels, attachments, ...card }) => ({
      ...card,
      assigneeIds: card_assignees.map((a) => a.user_id),
      labelIds: card_labels.map((l) => l.label_id),
      attachmentCount: attachments?.[0]?.count ?? 0,
    })
  );

  return (
    <BoardCanvas
      board={{
        id: board.id,
        org_id: board.org_id,
        title: board.title,
        color: board.color,
        created_at: board.created_at,
      }}
      orgName={board.organizations?.name ?? ""}
      initialLists={(lists ?? []) as List[]}
      initialCards={cards}
      initialLabels={(labels ?? []) as Label[]}
      members={(members ?? []) as unknown as OrgMember[]}
      currentUserId={user.id}
      initialCardId={initialCardId ?? null}
      initialAssigneeFilter={parseAssigneeParam(
        assignee,
        (members ?? []).map((m) => m.user_id)
      )}
    />
  );
}
