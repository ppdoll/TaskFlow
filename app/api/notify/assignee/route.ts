import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CardInfo {
  id: string;
  title: string;
  board_id: string;
  boards: {
    title: string;
    organizations: { name: string } | null;
  } | null;
}

/**
 * 카드 담당자 배정 시 이메일 알림.
 * - 요청자는 로그인 상태여야 하며, RLS 덕분에 자신이 볼 수 있는 카드만 조회됨
 *   (보드 멤버가 아니면 카드 조회가 안 되어 404).
 * - RESEND_API_KEY 가 없으면 발송을 건너뜀 (에러 아님).
 */
export async function POST(request: Request) {
  let body: { cardId?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { cardId, userId } = body;
  if (!cardId || !userId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 본인이 본인을 담당자로 지정한 경우 메일 생략
  if (user.id === userId) {
    return NextResponse.json({ skipped: "self_assign" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ skipped: "email_not_configured" });
  }

  const [{ data: cardData }, { data: assignee }, { data: actor }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("id, title, board_id, boards(title, organizations(name))")
        .eq("id", cardId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("email, name")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    ]);

  const card = cardData as unknown as CardInfo | null;
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }
  if (!assignee?.email) {
    return NextResponse.json({ error: "assignee_not_found" }, { status: 404 });
  }

  const orgName = card.boards?.organizations?.name ?? "";
  const boardTitle = card.boards?.title ?? "";
  const actorName = actor?.name ?? "팀원";
  const boardUrl = `${new URL(request.url).origin}/board/${card.board_id}`;
  const from = process.env.EMAIL_FROM ?? "업무보드 <onboarding@resend.dev>";

  const subject = `[업무보드] 새 업무가 배정되었습니다: ${card.title}`;
  const html = `
    <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#0284c7;margin:0 0 4px;">업무보드</h2>
      <p style="color:#334155;font-size:15px;line-height:1.6;">
        안녕하세요, <strong>${escapeHtml(assignee.name)}</strong> 님.<br/>
        <strong>${escapeHtml(actorName)}</strong> 님이 회원님을 업무 담당자로 지정했습니다.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(orgName)} · ${escapeHtml(boardTitle)}</p>
        <p style="margin:6px 0 0;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(card.title)}</p>
      </div>
      <a href="${boardUrl}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;">보드에서 확인하기</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">이 메일은 업무보드에서 자동 발송되었습니다.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [assignee.email], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[notify/assignee] 메일 발송 실패:", res.status, detail);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
