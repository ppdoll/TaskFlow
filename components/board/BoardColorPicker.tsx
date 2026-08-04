"use client";

import { BOARD_PRESETS, boardTheme, isHexColor } from "@/lib/utils";

/** 보드 테마 색 선택 — 프리셋 팔레트 + 임의 색상 */
export default function BoardColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const theme = boardTheme(value);
  const isCustom = isHexColor(value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {BOARD_PRESETS.map((preset) => {
          const selected = value === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(preset.key)}
              title={preset.name}
              className={`group flex flex-col items-center gap-1 rounded-lg p-1.5 transition ${
                selected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`h-8 w-full rounded-lg transition ${
                  selected
                    ? "ring-2 ring-slate-900 ring-offset-2"
                    : "group-hover:opacity-85"
                }`}
                style={{ backgroundColor: preset.tile }}
              />
              <span className="w-full truncate text-[10px] leading-3 text-slate-500">
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="color"
            value={theme.tile}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            aria-label="직접 색상 고르기"
          />
          직접 고르기
        </label>
        <input
          type="text"
          value={isCustom ? value : theme.tile}
          onChange={(e) => {
            const next = e.target.value.trim();
            if (isHexColor(next)) onChange(next.toLowerCase());
          }}
          placeholder="#0F4C81"
          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm"
          aria-label="색상 코드"
        />
        <span className="flex-1" />
        <span
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: theme.tile, color: theme.onTile }}
        >
          미리보기
        </span>
      </div>
    </div>
  );
}
