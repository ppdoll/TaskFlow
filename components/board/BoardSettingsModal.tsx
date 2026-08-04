"use client";

import { useEffect, useState } from "react";
import BoardColorPicker from "./BoardColorPicker";
import { boardTheme } from "@/lib/utils";

export default function BoardSettingsModal({
  initialTitle,
  initialColor,
  onClose,
  onSave,
  onDelete,
}: {
  initialTitle: string;
  initialColor: string;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState(initialColor);
  const theme = boardTheme(color);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next) return;
    onSave(next, color);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/25 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold">보드 수정</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-xl text-slate-400 transition hover:bg-slate-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              보드 이름
            </label>
            <input
              type="text"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              테마 색상
            </label>
            <BoardColorPicker value={color} onChange={setColor} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">미리보기</p>
            <div
              className="rounded-xl border border-black/5 p-3"
              style={{ backgroundColor: theme.surface }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: theme.tile, color: theme.onTile }}
                >
                  {title || "보드 이름"}
                </span>
              </div>
              <div className="rounded-lg bg-slate-100/85 p-2">
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                  카드가 이렇게 보입니다
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            취소
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            보드 삭제
          </button>
        </div>
      </form>
    </div>
  );
}
