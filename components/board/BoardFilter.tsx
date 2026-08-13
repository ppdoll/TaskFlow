"use client";

import AssigneeFilterMenu, {
  type FilterCounts,
} from "@/components/AssigneeFilterMenu";
import { matchesAssignee } from "@/lib/utils";
import type { Card, OrgMember } from "@/lib/types";

export type { FilterCounts };

/** 카드가 현재 담당자 필터에 걸리는지 */
export function matchesAssigneeFilter(
  card: Card,
  selected: string[]
): boolean {
  return matchesAssignee(card.assigneeIds, selected);
}

/** 칸반 보드용 담당자 필터 (로컬 상태 — 즉시 반영) */
export default function BoardFilter({
  members,
  selected,
  onChange,
  counts,
}: {
  members: OrgMember[];
  selected: string[];
  onChange: (next: string[]) => void;
  counts: FilterCounts;
}) {
  return (
    <AssigneeFilterMenu
      members={members}
      selected={selected}
      counts={counts}
      align="left"
      size="sm"
      onToggle={(id) =>
        onChange(
          selected.includes(id)
            ? selected.filter((v) => v !== id)
            : [...selected, id]
        )
      }
      onClear={() => onChange([])}
    />
  );
}
