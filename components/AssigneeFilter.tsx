"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AssigneeFilterMenu, {
  type FilterCounts,
} from "@/components/AssigneeFilterMenu";
import type { OrgMember } from "@/lib/types";

/**
 * 상태별·타임라인·캘린더·보고서 공용 담당자 필터.
 * 선택값을 URL(?assignee=a,b) 에 담아 뷰를 바꿔도 유지되고 링크 공유도 된다.
 */
export default function AssigneeFilter({
  members,
  selected,
  counts,
}: {
  members: OrgMember[];
  selected: string[];
  counts: FilterCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("assignee");
    else params.set("assignee", next.join(","));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AssigneeFilterMenu
      members={members}
      selected={selected}
      counts={counts}
      align="right"
      size="md"
      onToggle={(id) =>
        apply(
          selected.includes(id)
            ? selected.filter((v) => v !== id)
            : [...selected, id]
        )
      }
      onClear={() => apply([])}
    />
  );
}
