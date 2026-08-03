"use client";

import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CardItem from "./CardItem";
import type { Card, Label, List, Profile } from "@/lib/types";

export default function ListColumn({
  list,
  cards,
  labelsById,
  profilesById,
  onAddCard,
  onCardClick,
  onRenameList,
  onDeleteList,
  overlay = false,
}: {
  list: List;
  cards: Card[];
  labelsById: Map<string, Label>;
  profilesById: Map<string, Profile>;
  onAddCard: (listId: string, title: string) => void;
  onCardClick: (cardId: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
  overlay?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(list.title);
  const [composing, setComposing] = useState(false);
  const [cardTitle, setCardTitle] = useState("");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: list.id,
      data: { type: "list" },
      disabled: overlay,
    });

  const style = overlay
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition };

  function commitTitle() {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== list.title) {
      onRenameList(list.id, next);
    } else {
      setTitleDraft(list.title);
    }
  }

  function submitCard(e: React.FormEvent) {
    e.preventDefault();
    const title = cardTitle.trim();
    if (!title) return;
    onAddCard(list.id, title);
    setCardTitle("");
  }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-100 shadow ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "rotate-1 shadow-xl" : ""}`}
    >
      {/* 헤더 (드래그 핸들) */}
      <div
        className="flex items-center gap-2 px-3 pt-3 pb-2"
        {...(overlay ? {} : attributes)}
        {...(overlay ? {} : listeners)}
      >
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(list.title);
                setEditingTitle(false);
              }
            }}
            className="w-full rounded border border-sky-400 px-2 py-1 text-sm font-semibold focus:outline-none"
          />
        ) : (
          <h3
            className="flex-1 cursor-text px-1 text-sm font-semibold text-slate-700"
            onClick={() => {
              setTitleDraft(list.title);
              setEditingTitle(true);
            }}
          >
            {list.title}
            <span className="ml-2 font-normal text-slate-400">
              {cards.length}
            </span>
          </h3>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteList(list.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded px-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-red-600"
          title="리스트 삭제"
        >
          ×
        </button>
      </div>

      {/* 카드 목록 */}
      <div className="list-scroll flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              labels={card.labelIds
                .map((id) => labelsById.get(id))
                .filter((l): l is Label => !!l)}
              assignees={card.assigneeIds
                .map((id) => profilesById.get(id))
                .filter((p): p is Profile => !!p)}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>
      </div>

      {/* 카드 추가 */}
      <div className="px-3 pb-3">
        {composing ? (
          <form onSubmit={submitCard}>
            <textarea
              autoFocus
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitCard(e);
                }
                if (e.key === "Escape") setComposing(false);
              }}
              placeholder="카드 제목 입력..."
              rows={2}
              className="w-full resize-none rounded-lg border border-sky-400 bg-white p-2 text-sm shadow-sm focus:outline-none"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-200"
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 transition hover:bg-slate-200"
          >
            + 카드 추가
          </button>
        )}
      </div>
    </div>
  );
}
