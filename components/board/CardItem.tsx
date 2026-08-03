"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  avatarColor,
  formatDate,
  initial,
  isOverdue,
  labelColor,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/utils";
import type { Card, Label, Profile } from "@/lib/types";

export default function CardItem({
  card,
  labels,
  assignees,
  onClick,
  overlay = false,
}: {
  card: Card;
  labels: Label[];
  assignees: Profile[];
  onClick?: () => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: "card" },
      disabled: overlay,
    });

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const overdue = isOverdue(card.due_date);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-sky-300 ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "rotate-2 shadow-lg" : ""}`}
    >
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label.id}
              title={label.name}
              className={`h-2 w-8 rounded-full ${labelColor(label.color)}`}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-slate-800">{card.title}</p>

      {(card.due_date ||
        card.description ||
        card.attachmentCount > 0 ||
        card.status !== "ready" ||
        assignees.length > 0) && (
        <div className="mt-2 flex items-center gap-2">
          {card.status !== "ready" && (
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[card.status]}`}
            >
              {STATUS_LABELS[card.status]}
            </span>
          )}
          {card.due_date && (
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                overdue
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {formatDate(card.due_date)}
            </span>
          )}
          {card.description && (
            <span className="text-xs text-slate-400" title="설명 있음">
              ≡
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span className="text-xs text-slate-400" title="첨부">
              📎{card.attachmentCount}
            </span>
          )}
          <span className="flex-1" />
          {assignees.slice(0, 3).map((p) => (
            <span
              key={p.id}
              title={p.name}
              className={`-ml-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white ${avatarColor(p.id)}`}
            >
              {initial(p.name)}
            </span>
          ))}
          {assignees.length > 3 && (
            <span className="text-xs text-slate-400">
              +{assignees.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
