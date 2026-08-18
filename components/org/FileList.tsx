"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  avatarColor,
  boardTheme,
  formatDateTime,
  formatFileSize,
  initial,
} from "@/lib/utils";
import type { AttachmentListItem } from "@/lib/types";

/** 확장자·MIME 으로 대략적인 아이콘 선택 */
function fileIcon(item: AttachmentListItem): string {
  if (item.type === "link") return "🔗";
  const mime = item.mime_type ?? "";
  const ext = item.name.includes(".")
    ? item.name.slice(item.name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (ext === "pdf") return "📕";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["doc", "docx", "hwp", "hwpx"].includes(ext)) return "📝";
  if (["ppt", "pptx"].includes(ext)) return "📽️";
  if (["zip", "7z", "rar"].includes(ext)) return "🗜️";
  return "📄";
}

type TypeFilter = "all" | "file" | "link";

export default function FileList({
  items,
  showBoardName = true,
}: {
  items: AttachmentListItem[];
  showBoardName?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.cards?.title ?? "",
        item.boards?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, typeFilter]);

  const stats = useMemo(() => {
    const files = items.filter((i) => i.type === "file");
    return {
      files: files.length,
      links: items.length - files.length,
      bytes: files.reduce((sum, i) => sum + (i.size ?? 0), 0),
    };
  }, [items]);

  async function open(item: AttachmentListItem) {
    if (item.type === "link") {
      window.open(item.url, "_blank", "noopener");
      return;
    }
    setBusyId(item.id);
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(item.url, 3600);
    setBusyId(null);
    if (error || !data?.signedUrl) {
      alert("파일을 여는 데 실패했습니다.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const chip = (value: TypeFilter, label: string) => (
    <button
      key={value}
      onClick={() => setTypeFilter(value)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        typeFilter === value
          ? "bg-sky-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* 검색 + 종류 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="파일 이름 또는 업무 이름으로 검색"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
        {chip("all", `전체 ${items.length}`)}
        {chip("file", `📄 파일 ${stats.files}`)}
        {chip("link", `🔗 링크 ${stats.links}`)}
      </div>

      <p className="text-xs text-slate-400">
        파일 {stats.files}개 · 총 {formatFileSize(stats.bytes) || "0B"} · 링크{" "}
        {stats.links}개
        {query.trim() && ` · 검색 결과 ${filtered.length}건`}
      </p>

      {/* 목록 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">
            {items.length === 0
              ? "아직 첨부된 파일이 없습니다. 카드를 열어 파일이나 링크를 첨부해보세요."
              : "검색 결과가 없습니다."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const theme = item.boards
                ? boardTheme(item.boards.color)
                : null;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-slate-50"
                >
                  <span className="text-xl leading-none">{fileIcon(item)}</span>

                  <div className="min-w-0 flex-1 basis-64">
                    <button
                      onClick={() => open(item)}
                      disabled={busyId === item.id}
                      title={item.type === "link" ? item.url : item.name}
                      className="block max-w-full truncate text-left text-sm font-medium text-slate-800 hover:text-sky-700 hover:underline disabled:opacity-50"
                    >
                      {busyId === item.id ? "여는 중..." : item.name}
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                      {showBoardName && item.boards && (
                        <span className="flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded"
                            style={{ backgroundColor: theme?.tile }}
                          />
                          {item.boards.title}
                        </span>
                      )}
                      <span>{formatDateTime(item.created_at)}</span>
                      {item.type === "file" && item.size !== null && (
                        <span>{formatFileSize(item.size)}</span>
                      )}
                    </p>
                  </div>

                  {/* 연결된 업무 */}
                  {item.card_id ? (
                    <Link
                      href={`/board/${item.board_id}?card=${item.card_id}`}
                      className="max-w-56 truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-sky-100 hover:text-sky-700"
                      title={`업무 열기: ${item.cards?.title ?? ""}`}
                    >
                      🗂️ {item.cards?.title ?? "삭제된 업무"}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">업무 없음</span>
                  )}

                  {/* 올린 사람 */}
                  {item.created_by && (
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(item.created_by)}`}
                      title={`올린 사람: ${item.profiles?.name ?? "?"}`}
                    >
                      {initial(item.profiles?.name ?? "?")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
