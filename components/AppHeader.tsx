"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avatarColor, initial } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";

export default function AppHeader({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/orgs" className="text-lg font-bold text-sky-700">
          업무보드
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell userId={userId} />
          <Link
            href="/help"
            className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-sky-600"
          >
            도움말
          </Link>
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(userId)}`}
            title={userName}
          >
            {initial(userName)}
          </span>
          <span className="hidden text-sm text-slate-600 sm:block">
            {userName}
          </span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
