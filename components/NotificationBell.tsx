"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { runQuery, statusLabel, timeAgo } from "@/lib/utils";
import type { Notification } from "@/lib/types";

function notificationText(n: Notification): string {
  const d = n.data;
  switch (n.type) {
    case "assigned":
      return `${d.actor_name} 님이 '${d.card_title}' 업무를 회원님에게 배정했습니다.`;
    case "card_moved":
      return `${d.actor_name} 님이 '${d.card_title}' 업무를 '${d.from}' → '${d.to}' 로 이동했습니다.`;
    case "status_changed":
      return `${d.actor_name} 님이 '${d.card_title}' 상태를 '${statusLabel(d.from ?? "?")}' → '${statusLabel(d.to ?? "?")}' 로 변경했습니다.`;
    case "due_soon": {
      const days = Number(d.days_left ?? 0);
      if (days <= 0) return `'${d.card_title}' 마감일이 오늘입니다.`;
      return `'${d.card_title}' 마감이 ${days}일 남았습니다. (${d.due_date})`;
    }
    default:
      return n.type;
  }
}

function notificationIcon(type: string): string {
  switch (type) {
    case "assigned":
      return "👤";
    case "card_moved":
      return "↔️";
    case "status_changed":
      return "⚡";
    case "due_soon":
      return "⏰";
    default:
      return "🔔";
  }
}

export default function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false),
      ]);
      if (!cancelled) {
        setItems((data ?? []) as Notification[]);
        setUnread(count ?? 0);
      }
    })();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          setItems((prev) =>
            prev.some((i) => i.id === row.id)
              ? prev
              : [row, ...prev].slice(0, 30)
          );
          setUnread((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  function handleItemClick(n: Notification) {
    if (!n.is_read) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i))
      );
      setUnread((c) => Math.max(0, c - 1));
      runQuery(
        supabase.from("notifications").update({ is_read: true }).eq("id", n.id)
      );
    }
    setOpen(false);
    router.push(`/board/${n.board_id}${n.card_id ? `?card=${n.card_id}` : ""}`);
  }

  function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    setUnread(0);
    runQuery(
      supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false)
    );
  }

  const buttonCls =
    "relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={buttonCls}
        aria-label={`알림 ${unread}개`}
        title="알림"
      >
        {/* 종 아이콘 */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-slate-700">알림</h3>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  모두 읽음
                </button>
              )}
            </div>

            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  새 알림이 없습니다.
                </li>
              )}
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleItemClick(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      n.is_read ? "" : "bg-sky-50/70"
                    }`}
                  >
                    <span className="mt-0.5 text-lg leading-none">
                      {notificationIcon(n.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-5 text-slate-700">
                        {notificationText(n)}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {n.data.board_title} · {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
