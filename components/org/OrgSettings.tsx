"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  avatarColor,
  formatDate,
  initial,
  ROLE_LABELS,
} from "@/lib/utils";
import type { Invite, Organization, OrgMember, Role } from "@/lib/types";

function expiryFromDays(days: string): string | null {
  if (days === "") return null;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString();
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
const sectionCls =
  "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

export default function OrgSettings({
  org,
  members,
  invites,
  myUserId,
  myRole,
}: {
  org: Organization;
  members: OrgMember[];
  invites: Invite[];
  myUserId: string;
  myRole: Role;
}) {
  const router = useRouter();
  const supabase = createClient();

  // --- 기본 정보 ---
  const [name, setName] = useState(org.name);
  const [domains, setDomains] = useState(
    (org.allowed_domains ?? []).join(", ")
  );
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setInfoMsg(null);

    const domainList = domains
      .split(",")
      .map((d) => d.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);

    const { error } = await supabase
      .from("organizations")
      .update({
        name: name.trim(),
        allowed_domains: domainList.length > 0 ? domainList : null,
      })
      .eq("id", org.id);

    setSavingInfo(false);
    setInfoMsg(error ? `오류: ${error.message}` : "저장되었습니다.");
    if (!error) router.refresh();
  }

  // --- 초대 링크 ---
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [expiresDays, setExpiresDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    setInviteError(null);

    const expiresAt = expiryFromDays(expiresDays);

    const { error } = await supabase.from("invites").insert({
      org_id: org.id,
      role: inviteRole,
      expires_at: expiresAt,
      max_uses: maxUses === "" ? null : Number(maxUses),
      created_by: myUserId,
    });

    setCreatingInvite(false);
    if (error) {
      setInviteError(error.message);
      return;
    }
    router.refresh();
  }

  async function revokeInvite(id: string) {
    if (!confirm("이 초대 링크를 삭제할까요? 삭제하면 더 이상 사용할 수 없습니다.")) return;
    await supabase.from("invites").delete().eq("id", id);
    router.refresh();
  }

  async function copyInviteLink(invite: Invite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function inviteStatus(invite: Invite): string | null {
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return "만료됨";
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses)
      return "소진됨";
    return null;
  }

  // --- 조직 삭제 (조직장 전용) ---
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteOrganization() {
    if (deleteConfirm.trim() !== org.name) return;
    setDeleting(true);
    setDeleteError(null);

    // RLS 에 막히면 에러 없이 0건 삭제로 끝나므로 실제 삭제 여부를 확인한다
    const { data, error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", org.id)
      .select("id");

    if (error) {
      setDeleting(false);
      setDeleteError(`삭제 실패: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setDeleting(false);
      setDeleteError(
        "삭제되지 않았습니다. 조직장 권한이 있는지 확인해주세요."
      );
      return;
    }
    router.push("/orgs");
    router.refresh();
  }

  // --- 멤버 관리 ---
  async function changeRole(userId: string, role: string) {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("org_id", org.id)
      .eq("user_id", userId);
    if (error) alert(`오류: ${error.message}`);
    router.refresh();
  }

  async function removeMember(member: OrgMember) {
    if (
      !confirm(
        `${member.profiles?.name} 님을 조직에서 내보낼까요?`
      )
    )
      return;
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("org_id", org.id)
      .eq("user_id", member.user_id);
    if (error) alert(`오류: ${error.message}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* 기본 정보 */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-lg font-semibold">기본 정보</h2>
        <form onSubmit={saveInfo} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              조직 이름
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              허용 이메일 도메인
            </label>
            <input
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="예: billionairegames.co.kr (쉼표로 여러 개, 비우면 제한 없음)"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              설정하면 해당 도메인의 이메일 계정만 초대 링크를 수락할 수
              있습니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingInfo}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              저장
            </button>
            {infoMsg && <span className="text-sm text-slate-500">{infoMsg}</span>}
          </div>
        </form>
      </section>

      {/* 초대 링크 */}
      <section className={sectionCls}>
        <h2 className="mb-1 text-lg font-semibold">초대 링크</h2>
        <p className="mb-4 text-sm text-slate-500">
          링크를 만들어 팀원에게 공유하세요. 링크를 받은 사람은 로그인(또는
          가입) 후 조직에 참여할 수 있습니다.
        </p>

        <form
          onSubmit={createInvite}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              부여할 역할
            </label>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "member" | "admin")
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="member">멤버</option>
              <option value="admin">관리자</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              유효 기간
            </label>
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="1">1일</option>
              <option value="7">7일</option>
              <option value="30">30일</option>
              <option value="">무기한</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              최대 사용 횟수
            </label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="무제한"
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creatingInvite}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            링크 만들기
          </button>
          {inviteError && (
            <p className="w-full text-sm text-red-600">{inviteError}</p>
          )}
        </form>

        {invites.length === 0 ? (
          <p className="text-sm text-slate-400">생성된 초대 링크가 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-slate-500">
                      /invite/{invite.token}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {ROLE_LABELS[invite.role]} 권한 ·{" "}
                      {invite.expires_at
                        ? `${formatDate(invite.expires_at)} 까지`
                        : "무기한"}{" "}
                      · 사용 {invite.used_count}
                      {invite.max_uses !== null ? ` / ${invite.max_uses}` : ""}회
                      {status && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-600">
                          {status}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => copyInviteLink(invite)}
                    disabled={!!status}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                  >
                    {copiedId === invite.id ? "복사됨!" : "링크 복사"}
                  </button>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 멤버 관리 */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-lg font-semibold">
          멤버{" "}
          <span className="text-sm font-normal text-slate-400">
            {members.length}명
          </span>
        </h2>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 py-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(m.user_id)}`}
              >
                {initial(m.profiles?.name ?? "")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.profiles?.name}
                  {m.user_id === myUserId && (
                    <span className="ml-1 text-xs text-slate-400">(나)</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {m.profiles?.email}
                </p>
              </div>

              {m.role === "owner" ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  조직장
                </span>
              ) : (
                <>
                  {myRole === "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="admin">관리자</option>
                      <option value="member">멤버</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {m.user_id !== myUserId && (
                    <button
                      onClick={() => removeMember(m)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      내보내기
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 조직 삭제 (조직장 전용) */}
      {myRole === "owner" && (
        <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-red-600">조직 삭제</h2>
          <p className="mb-4 text-sm leading-6 text-slate-600">
            조직을 삭제하면 <strong>모든 보드·리스트·카드·첨부·댓글</strong>이
            함께 삭제되며 되돌릴 수 없습니다. 멤버 {members.length}명의 접근도
            즉시 사라집니다.
          </p>

          {!deleteOpen ? (
            <button
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              조직 삭제하기
            </button>
          ) : (
            <div className="space-y-3 rounded-lg bg-red-50 p-4">
              <p className="text-sm text-slate-700">
                확인을 위해 조직 이름{" "}
                <strong className="font-mono">{org.name}</strong> 을(를) 그대로
                입력하세요.
              </p>
              <input
                type="text"
                autoFocus
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={org.name}
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={deleteOrganization}
                  disabled={deleteConfirm.trim() !== org.name || deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? "삭제 중..." : "영구 삭제"}
                </button>
                <button
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                    setDeleteError(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
