"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import {
  boardTheme,
  nextPosition,
  positionBetween,
  runQuery,
} from "@/lib/utils";
import ListColumn from "./ListColumn";
import CardItem from "./CardItem";
import CardModal from "./CardModal";
import BoardSettingsModal from "./BoardSettingsModal";
import BoardFilter, {
  FILTER_ALL,
  FILTER_NONE,
  matchesAssigneeFilter,
} from "./BoardFilter";
import NotificationBell from "@/components/NotificationBell";
import type { Board, Card, Label, List, OrgMember, Profile } from "@/lib/types";

type CardRow = Omit<Card, "assigneeIds" | "labelIds" | "attachmentCount">;

function sortByPosition<T extends { position: number; id: string }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id)
  );
}

export default function BoardCanvas({
  board,
  orgName,
  initialLists,
  initialCards,
  initialLabels,
  members,
  currentUserId,
  initialCardId = null,
}: {
  board: Board;
  orgName: string;
  initialLists: List[];
  initialCards: Card[];
  initialLabels: Label[];
  members: OrgMember[];
  currentUserId: string;
  initialCardId?: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lists, setLists] = useState<List[]>(initialLists);
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  const [boardTitle, setBoardTitle] = useState(board.title);
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [boardColorValue, setBoardColorValue] = useState(board.color);
  const [showBoardSettings, setShowBoardSettings] = useState(false);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<List | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    initialCardId
  );

  // 알림 클릭으로 진입한 경우 해당 카드 자동 열기 (렌더 중 상태 조정 패턴)
  const [prevInitialCardId, setPrevInitialCardId] = useState(initialCardId);
  if (initialCardId !== prevInitialCardId) {
    setPrevInitialCardId(initialCardId);
    if (initialCardId) setSelectedCardId(initialCardId);
  }

  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(FILTER_ALL);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const labelsById = useMemo(
    () => new Map(labels.map((l) => [l.id, l])),
    [labels]
  );
  const profilesById = useMemo(
    () =>
      new Map<string, Profile>(
        members.filter((m) => m.profiles).map((m) => [m.user_id, m.profiles])
      ),
    [members]
  );

  const sortedLists = useMemo(() => sortByPosition(lists), [lists]);
  const cardsByList = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const list of lists) map.set(list.id, []);
    for (const card of sortByPosition(cards)) {
      if (!matchesAssigneeFilter(card, assigneeFilter)) continue;
      map.get(card.list_id)?.push(card);
    }
    return map;
  }, [lists, cards, assigneeFilter]);

  const filterCounts = useMemo(() => {
    const byUser: Record<string, number> = {};
    let none = 0;
    for (const card of cards) {
      if (card.assigneeIds.length === 0) none++;
      for (const id of card.assigneeIds) {
        byUser[id] = (byUser[id] ?? 0) + 1;
      }
    }
    return { all: cards.length, none, byUser };
  }, [cards]);

  const selectedCard = selectedCardId
    ? (cards.find((c) => c.id === selectedCardId) ?? null)
    : null;

  // ------------------------------------------------------------
  // 실시간 동기화
  // ------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`board-${board.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cards",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as CardRow;
            setCards((prev) =>
              prev.some((c) => c.id === row.id)
                ? prev
                : [
                    ...prev,
                    { ...row, assigneeIds: [], labelIds: [], attachmentCount: 0 },
                  ]
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as CardRow;
            setCards((prev) =>
              prev.map((c) => (c.id === row.id ? { ...c, ...row } : c))
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setCards((prev) => prev.filter((c) => c.id !== row.id));
            setSelectedCardId((prev) => (prev === row.id ? null : prev));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lists",
          filter: `board_id=eq.${board.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as List;
            setLists((prev) =>
              prev.some((l) => l.id === row.id) ? prev : [...prev, row]
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as List;
            setLists((prev) =>
              prev.map((l) => (l.id === row.id ? { ...l, ...row } : l))
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setLists((prev) => prev.filter((l) => l.id !== row.id));
            setCards((prev) => prev.filter((c) => c.list_id !== row.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "card_assignees" },
        (payload) => {
          const row = payload.new as { card_id: string; user_id: string };
          setCards((prev) =>
            prev.map((c) =>
              c.id === row.card_id && !c.assigneeIds.includes(row.user_id)
                ? { ...c, assigneeIds: [...c.assigneeIds, row.user_id] }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "card_assignees" },
        (payload) => {
          const row = payload.old as { card_id: string; user_id: string };
          setCards((prev) =>
            prev.map((c) =>
              c.id === row.card_id
                ? {
                    ...c,
                    assigneeIds: c.assigneeIds.filter(
                      (id) => id !== row.user_id
                    ),
                  }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "card_labels" },
        (payload) => {
          const row = payload.new as { card_id: string; label_id: string };
          setCards((prev) =>
            prev.map((c) =>
              c.id === row.card_id && !c.labelIds.includes(row.label_id)
                ? { ...c, labelIds: [...c.labelIds, row.label_id] }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "card_labels" },
        (payload) => {
          const row = payload.old as { card_id: string; label_id: string };
          setCards((prev) =>
            prev.map((c) =>
              c.id === row.card_id
                ? {
                    ...c,
                    labelIds: c.labelIds.filter((id) => id !== row.label_id),
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, board.id]);

  // ------------------------------------------------------------
  // 드래그 & 드롭
  // ------------------------------------------------------------
  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type;
    if (type === "card") {
      setActiveCard(cards.find((c) => c.id === event.active.id) ?? null);
    } else if (type === "list") {
      setActiveList(lists.find((l) => l.id === event.active.id) ?? null);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "card") return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;
    const overType = over.data.current?.type as string | undefined;

    setCards((prev) => {
      const activeItem = prev.find((c) => c.id === activeId);
      if (!activeItem) return prev;

      let targetListId: string | null = null;
      if (overType === "card") {
        targetListId = prev.find((c) => c.id === overId)?.list_id ?? null;
      } else if (overType === "list") {
        targetListId = overId;
      }
      if (!targetListId || activeItem.list_id === targetListId) return prev;

      // 다른 리스트로 이동 (일단 맨 끝에 배치, 최종 위치는 dragEnd 에서 확정)
      // 필터가 걸려 있으면 화면에 보이는 카드 기준으로 계산해야 위치가 어긋나지 않는다
      const targetCards = prev.filter(
        (c) =>
          c.list_id === targetListId && matchesAssigneeFilter(c, assigneeFilter)
      );
      const pos = nextPosition(targetCards);
      return prev.map((c) =>
        c.id === activeId ? { ...c, list_id: targetListId!, position: pos } : c
      );
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    setActiveList(null);
    if (!over) return;

    const type = active.data.current?.type;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (type === "list") {
      if (activeId === overId) return;
      const oldIndex = sortedLists.findIndex((l) => l.id === activeId);
      const newIndex = sortedLists.findIndex((l) => l.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sortedLists, oldIndex, newIndex);
      const pos = positionBetween(
        reordered[newIndex - 1]?.position,
        reordered[newIndex + 1]?.position
      );
      setLists((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, position: pos } : l))
      );
      runQuery(
        supabase.from("lists").update({ position: pos }).eq("id", activeId)
      );
      return;
    }

    if (type === "card") {
      const current = cards.find((c) => c.id === activeId);
      if (!current) return;

      const overType = over.data.current?.type as string | undefined;
      let targetListId = current.list_id;
      if (overType === "list") {
        targetListId = overId;
      } else if (overType === "card") {
        targetListId =
          cards.find((c) => c.id === overId)?.list_id ?? targetListId;
      }

      // 화면에 보이는 카드끼리의 순서로 위치를 정한다 (필터 적용 시 WYSIWYG 유지)
      const siblings = sortByPosition(
        cards.filter(
          (c) =>
            c.list_id === targetListId &&
            matchesAssigneeFilter(c, assigneeFilter)
        )
      );
      const oldIndex = siblings.findIndex((c) => c.id === activeId);
      if (oldIndex < 0) return;

      let newIndex = siblings.length - 1;
      if (overType === "card" && overId !== activeId) {
        const overIndex = siblings.findIndex((c) => c.id === overId);
        if (overIndex >= 0) newIndex = overIndex;
      }

      const reordered = arrayMove(siblings, oldIndex, newIndex);
      const idx = reordered.findIndex((c) => c.id === activeId);
      const pos = positionBetween(
        reordered[idx - 1]?.position,
        reordered[idx + 1]?.position
      );

      setCards((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, list_id: targetListId, position: pos }
            : c
        )
      );
      runQuery(
        supabase
          .from("cards")
          .update({ list_id: targetListId, position: pos })
          .eq("id", activeId)
      );
    }
  }

  // ------------------------------------------------------------
  // 리스트 / 카드 CRUD
  // ------------------------------------------------------------
  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    const title = newListTitle.trim();
    if (!title) return;
    setNewListTitle("");
    const { data } = await supabase
      .from("lists")
      .insert({ board_id: board.id, title, position: nextPosition(lists) })
      .select()
      .single();
    if (data) {
      setLists((prev) =>
        prev.some((l) => l.id === data.id) ? prev : [...prev, data as List]
      );
    }
  }

  function handleRenameList(listId: string, title: string) {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, title } : l))
    );
    runQuery(supabase.from("lists").update({ title }).eq("id", listId));
  }

  function handleDeleteList(listId: string) {
    if (!confirm("리스트와 그 안의 모든 카드가 삭제됩니다. 계속할까요?"))
      return;
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setCards((prev) => prev.filter((c) => c.list_id !== listId));
    runQuery(supabase.from("lists").delete().eq("id", listId));
  }

  async function handleAddCard(listId: string, title: string) {
    const listCards = cards.filter((c) => c.list_id === listId);
    const { data } = await supabase
      .from("cards")
      .insert({
        board_id: board.id,
        list_id: listId,
        title,
        position: nextPosition(listCards),
        created_by: currentUserId,
      })
      .select()
      .single();
    if (data) {
      const row = data as CardRow;
      // 특정 담당자로 걸러 보는 중이면, 만든 카드가 바로 사라지지 않도록
      // 그 담당자를 자동으로 지정한다
      const autoAssignee =
        assigneeFilter !== FILTER_ALL && assigneeFilter !== FILTER_NONE
          ? assigneeFilter
          : null;

      setCards((prev) =>
        prev.some((c) => c.id === row.id)
          ? prev
          : [
              ...prev,
              {
                ...row,
                assigneeIds: autoAssignee ? [autoAssignee] : [],
                labelIds: [],
                attachmentCount: 0,
              },
            ]
      );

      if (autoAssignee) {
        runQuery(
          supabase
            .from("card_assignees")
            .insert({ card_id: row.id, user_id: autoAssignee })
        );
      }
    }
  }

  function handleUpdateCard(cardId: string, patch: Partial<CardRow>) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c))
    );
    runQuery(supabase.from("cards").update(patch).eq("id", cardId));
  }

  function handleDeleteCard(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setSelectedCardId(null);
    runQuery(supabase.from("cards").delete().eq("id", cardId));
  }

  function handleToggleAssignee(cardId: string, userId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.assigneeIds.includes(userId)) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, assigneeIds: c.assigneeIds.filter((id) => id !== userId) }
            : c
        )
      );
      runQuery(
        supabase
          .from("card_assignees")
          .delete()
          .eq("card_id", cardId)
          .eq("user_id", userId)
      );
    } else {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, assigneeIds: [...c.assigneeIds, userId] }
            : c
        )
      );
      void supabase
        .from("card_assignees")
        .insert({ card_id: cardId, user_id: userId })
        .then(({ error }) => {
          // 배정 성공 시 담당자에게 메일 알림 (실패해도 무시)
          if (!error && userId !== currentUserId) {
            void fetch("/api/notify/assignee", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardId, userId }),
            }).catch(() => {});
          }
        });
    }
  }

  function handleToggleLabel(cardId: string, labelId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.labelIds.includes(labelId)) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, labelIds: c.labelIds.filter((id) => id !== labelId) }
            : c
        )
      );
      runQuery(
        supabase
          .from("card_labels")
          .delete()
          .eq("card_id", cardId)
          .eq("label_id", labelId)
      );
    } else {
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, labelIds: [...c.labelIds, labelId] } : c
        )
      );
      runQuery(
        supabase
          .from("card_labels")
          .insert({ card_id: cardId, label_id: labelId })
      );
    }
  }

  async function handleCreateLabel(name: string, color: string) {
    const { data } = await supabase
      .from("labels")
      .insert({ board_id: board.id, name, color })
      .select()
      .single();
    if (data) setLabels((prev) => [...prev, data as Label]);
  }

  function handleAttachmentDelta(cardId: string, delta: number) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, attachmentCount: Math.max(0, c.attachmentCount + delta) }
          : c
      )
    );
  }

  function handleDeleteLabel(labelId: string) {
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
    setCards((prev) =>
      prev.map((c) =>
        c.labelIds.includes(labelId)
          ? { ...c, labelIds: c.labelIds.filter((id) => id !== labelId) }
          : c
      )
    );
    runQuery(supabase.from("labels").delete().eq("id", labelId));
  }

  function commitBoardTitle() {
    setEditingBoardTitle(false);
    const next = boardTitle.trim();
    if (next && next !== board.title) {
      runQuery(
        supabase.from("boards").update({ title: next }).eq("id", board.id)
      );
    } else {
      setBoardTitle(board.title);
    }
  }

  async function handleDeleteBoard() {
    if (!confirm("보드와 모든 리스트/카드가 삭제됩니다. 계속할까요?")) return;
    await supabase.from("boards").delete().eq("id", board.id);
    router.push(`/orgs/${board.org_id}`);
  }

  function handleSaveBoardSettings(title: string, color: string) {
    setBoardTitle(title);
    setBoardColorValue(color);
    setShowBoardSettings(false);
    runQuery(
      supabase.from("boards").update({ title, color }).eq("id", board.id)
    );
    router.refresh();
  }

  const theme = boardTheme(boardColorValue);

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: theme.surface }}
    >
      {/* 보드 헤더 */}
      {/* relative z-30: backdrop-blur 가 스택 컨텍스트를 만들기 때문에 z-index 를 주지 않으면
          뒤에 오는 리스트(역시 transform/blur 로 컨텍스트 생성)가 드롭다운 위로 올라온다 */}
      <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-black/5 bg-white/70 px-4 py-2.5 backdrop-blur-xl">
        <Link
          href={`/orgs/${board.org_id}`}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-sky-600 transition hover:bg-slate-100"
        >
          ← {orgName}
        </Link>
        {editingBoardTitle ? (
          <input
            autoFocus
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onBlur={commitBoardTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitBoardTitle();
              if (e.key === "Escape") {
                setBoardTitle(board.title);
                setEditingBoardTitle(false);
              }
            }}
            className="rounded-lg border border-sky-500 bg-white px-2 py-1 text-lg font-bold text-slate-900 focus:outline-none"
          />
        ) : (
          <h1
            className="cursor-text text-lg font-bold text-slate-900"
            onClick={() => setEditingBoardTitle(true)}
            title="클릭해서 이름 변경"
          >
            {boardTitle}
          </h1>
        )}
        <BoardFilter
          members={members}
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          counts={filterCounts}
        />
        <span className="flex-1" />
        <nav className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 text-sm">
          {[
            { href: `/board/${board.id}/status`, label: "상태별" },
            { href: `/board/${board.id}/timeline`, label: "타임라인" },
            { href: `/board/${board.id}/calendar`, label: "캘린더" },
            { href: `/board/${board.id}/report`, label: "보고서" },
          ].map((view) => (
            <Link
              key={view.href}
              href={view.href}
              className="rounded-md px-2.5 py-1 font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
            >
              {view.label}
            </Link>
          ))}
        </nav>
        <NotificationBell userId={currentUserId} />
        <Link
          href="/help"
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          title="사용 방법"
        >
          도움말
        </Link>
        <button
          onClick={() => setShowBoardSettings(true)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
          title="보드 이름·색상 변경"
        >
          ⚙️ 보드 수정
        </button>
      </header>

      {/* 보드 본문 */}
      <div className="board-scroll flex-1 overflow-x-auto overflow-y-hidden px-4 pt-4 pb-4">
        <DndContext
          id={`board-dnd-${board.id}`}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full items-start gap-3">
            <SortableContext
              items={sortedLists.map((l) => l.id)}
              strategy={horizontalListSortingStrategy}
            >
              {sortedLists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  cards={cardsByList.get(list.id) ?? []}
                  labelsById={labelsById}
                  profilesById={profilesById}
                  onAddCard={handleAddCard}
                  onCardClick={setSelectedCardId}
                  onRenameList={handleRenameList}
                  onDeleteList={handleDeleteList}
                />
              ))}
            </SortableContext>

            {/* 리스트 추가 */}
            <div className="w-72 shrink-0">
              {addingList ? (
                <form
                  onSubmit={handleAddList}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <input
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAddingList(false);
                    }}
                    placeholder="리스트 이름 입력..."
                    className="w-full rounded-lg border border-sky-500 px-2 py-1.5 text-sm focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingList(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-200"
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingList(true)}
                  className="w-full rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-white"
                >
                  + 리스트 추가
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <CardItem
                card={activeCard}
                labels={activeCard.labelIds
                  .map((id) => labelsById.get(id))
                  .filter((l): l is Label => !!l)}
                assignees={activeCard.assigneeIds
                  .map((id) => profilesById.get(id))
                  .filter((p): p is Profile => !!p)}
                overlay
              />
            )}
            {activeList && (
              <ListColumn
                list={activeList}
                cards={cardsByList.get(activeList.id) ?? []}
                labelsById={labelsById}
                profilesById={profilesById}
                onAddCard={() => {}}
                onCardClick={() => {}}
                onRenameList={() => {}}
                onDeleteList={() => {}}
                overlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 카드 상세 모달 */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          listTitle={
            lists.find((l) => l.id === selectedCard.list_id)?.title ?? ""
          }
          labels={labels}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setSelectedCardId(null)}
          onUpdateCard={handleUpdateCard}
          onDeleteCard={handleDeleteCard}
          onToggleAssignee={handleToggleAssignee}
          onToggleLabel={handleToggleLabel}
          onCreateLabel={handleCreateLabel}
          onDeleteLabel={handleDeleteLabel}
          onAttachmentDelta={handleAttachmentDelta}
        />
      )}

      {showBoardSettings && (
        <BoardSettingsModal
          initialTitle={boardTitle}
          initialColor={boardColorValue}
          onClose={() => setShowBoardSettings(false)}
          onSave={handleSaveBoardSettings}
          onDelete={handleDeleteBoard}
        />
      )}
    </div>
  );
}
