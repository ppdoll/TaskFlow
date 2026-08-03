"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  activityText,
  avatarColor,
  formatDateTime,
  formatFileSize,
  initial,
  isOverdue,
  labelColor,
  LABEL_COLOR_KEYS,
  nextPosition,
  runQuery,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/utils";
import type {
  Activity,
  Attachment,
  Card,
  CardStatus,
  ChecklistItem,
  CommentRow,
  Label,
  OrgMember,
} from "@/lib/types";

type CardRow = Omit<Card, "assigneeIds" | "labelIds" | "attachmentCount">;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (스토리지 버킷 제한과 동일)

/** ISO → datetime-local 입력값 (로컬 시간대) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 입력값 → ISO (빈 값이면 null) */
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** 상태 변경 patch — 진행 시작/완료 시점에 시간 자동 기록 */
function buildStatusPatch(card: Card, status: CardStatus): Partial<CardRow> {
  const patch: Partial<CardRow> = { status };
  if (status === "in_progress" && !card.start_at) {
    patch.start_at = new Date().toISOString();
  }
  if (status === "done" && !card.end_at) {
    patch.end_at = new Date().toISOString();
  }
  return patch;
}

const sideBtnCls =
  "w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-200";

export default function CardModal({
  card,
  listTitle,
  labels,
  members,
  currentUserId,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onToggleAssignee,
  onToggleLabel,
  onCreateLabel,
  onDeleteLabel,
  onAttachmentDelta,
}: {
  card: Card;
  listTitle: string;
  labels: Label[];
  members: OrgMember[];
  currentUserId: string;
  onClose: () => void;
  onUpdateCard: (cardId: string, patch: Partial<CardRow>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleAssignee: (cardId: string, userId: string) => void;
  onToggleLabel: (cardId: string, labelId: string) => void;
  onCreateLabel: (name: string, color: string) => void;
  onDeleteLabel: (labelId: string) => void;
  onAttachmentDelta: (cardId: string, delta: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [descDirty, setDescDirty] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showActivity, setShowActivity] = useState(false);

  const [showAssignees, setShowAssignees] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("green");

  // Escape 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 체크리스트 / 댓글 / 첨부 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: items }, { data: cmts }, { data: atts }] =
        await Promise.all([
          supabase
            .from("checklist_items")
            .select("*")
            .eq("card_id", card.id)
            .order("position", { ascending: true }),
          supabase
            .from("comments")
            .select("*, profiles(name)")
            .eq("card_id", card.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("attachments")
            .select("*")
            .eq("card_id", card.id)
            .order("created_at", { ascending: true }),
        ]);
      if (!cancelled) {
        setChecklist((items ?? []) as ChecklistItem[]);
        setComments((cmts ?? []) as unknown as CommentRow[]);
        setAttachments((atts ?? []) as Attachment[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, card.id]);

  // 활동 기록 로드 (담당자/마감일/리스트 변경 시 새로고침)
  const assigneeKey = card.assigneeIds.join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("activities")
        .select("*, profiles(name)")
        .eq("card_id", card.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) setActivities((data ?? []) as unknown as Activity[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, card.id, assigneeKey, card.due_date, card.list_id]);

  const doneCount = checklist.filter((i) => i.is_done).length;
  const progress =
    checklist.length > 0
      ? Math.round((doneCount / checklist.length) * 100)
      : 0;

  function commitTitle() {
    const next = title.trim();
    if (next && next !== card.title) {
      onUpdateCard(card.id, { title: next });
    } else {
      setTitle(card.title);
    }
  }

  function saveDescription() {
    onUpdateCard(card.id, { description });
    setDescDirty(false);
  }

  async function addChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    const content = newItem.trim();
    if (!content) return;
    setNewItem("");
    const { data } = await supabase
      .from("checklist_items")
      .insert({
        card_id: card.id,
        content,
        position: nextPosition(checklist),
      })
      .select()
      .single();
    if (data) setChecklist((prev) => [...prev, data as ChecklistItem]);
  }

  function toggleChecklistItem(item: ChecklistItem) {
    setChecklist((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_done: !i.is_done } : i
      )
    );
    runQuery(
      supabase
        .from("checklist_items")
        .update({ is_done: !item.is_done })
        .eq("id", item.id)
    );
  }

  function deleteChecklistItem(id: string) {
    setChecklist((prev) => prev.filter((i) => i.id !== id));
    runQuery(supabase.from("checklist_items").delete().eq("id", id));
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;
    setNewComment("");
    const { data } = await supabase
      .from("comments")
      .insert({ card_id: card.id, user_id: currentUserId, content })
      .select("*, profiles(name)")
      .single();
    if (data) setComments((prev) => [...prev, data as unknown as CommentRow]);
  }

  function deleteComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    runQuery(supabase.from("comments").delete().eq("id", id));
  }

  // ---------- 첨부 ----------
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert("10MB 이하 파일만 첨부할 수 있습니다.");
      return;
    }
    setUploading(true);
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".") + 1)
      : "";
    const path = `${card.board_id}/${card.id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file);
    if (uploadError) {
      setUploading(false);
      alert(`업로드 실패: ${uploadError.message}`);
      return;
    }

    const { data, error } = await supabase
      .from("attachments")
      .insert({
        card_id: card.id,
        board_id: card.board_id,
        type: "file",
        name: file.name,
        url: path,
        size: file.size,
        mime_type: file.type || null,
        created_by: currentUserId,
      })
      .select()
      .single();
    setUploading(false);
    if (error) {
      alert(`첨부 저장 실패: ${error.message}`);
      return;
    }
    setAttachments((prev) => [...prev, data as Attachment]);
    onAttachmentDelta(card.id, 1);
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    const raw = linkUrl.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let name = linkName.trim();
    if (!name) {
      try {
        name = new URL(url).hostname;
      } catch {
        name = url;
      }
    }
    const { data, error } = await supabase
      .from("attachments")
      .insert({
        card_id: card.id,
        board_id: card.board_id,
        type: "link",
        name,
        url,
        created_by: currentUserId,
      })
      .select()
      .single();
    if (error) {
      alert(`링크 저장 실패: ${error.message}`);
      return;
    }
    setAttachments((prev) => [...prev, data as Attachment]);
    onAttachmentDelta(card.id, 1);
    setLinkUrl("");
    setLinkName("");
    setAddingLink(false);
  }

  async function openAttachment(att: Attachment) {
    if (att.type === "link") {
      window.open(att.url, "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(att.url, 3600);
    if (error || !data?.signedUrl) {
      alert("파일을 여는 데 실패했습니다.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function deleteAttachment(att: Attachment) {
    if (!confirm(`'${att.name}' 첨부를 삭제할까요?`)) return;
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    onAttachmentDelta(card.id, -1);
    if (att.type === "file") {
      runQuery(
        supabase.storage.from("attachments").remove([att.url]) as PromiseLike<{
          error: unknown;
        }>
      );
    }
    runQuery(supabase.from("attachments").delete().eq("id", att.id));
  }

  function handleCreateLabelSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = newLabelName.trim();
    if (!name) return;
    onCreateLabel(name, newLabelColor);
    setNewLabelName("");
  }

  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const overdue = isOverdue(card.due_date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full rounded-lg border border-transparent px-2 py-1 text-xl font-bold focus:border-sky-400 focus:outline-none"
            />
            <p className="mt-1 px-2 text-sm text-slate-400">
              리스트: <span className="font-medium">{listTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-xl text-slate-400 transition hover:bg-slate-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[1fr_220px]">
          {/* 왼쪽 본문 */}
          <div className="min-w-0 space-y-6">
            {/* 라벨/마감일/담당자 요약 */}
            {(cardLabels.length > 0 ||
              card.due_date ||
              card.assigneeIds.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {cardLabels.map((label) => (
                  <span
                    key={label.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${labelColor(label.color)}`}
                  >
                    {label.name}
                  </span>
                ))}
                {card.due_date && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      overdue
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    마감 {card.due_date}
                    {overdue && " · 지남"}
                  </span>
                )}
                {card.assigneeIds.map((uid) => {
                  const p = members.find((m) => m.user_id === uid)?.profiles;
                  if (!p) return null;
                  return (
                    <span
                      key={uid}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-slate-600"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(uid)}`}
                      >
                        {initial(p.name)}
                      </span>
                      {p.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 설명 */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                설명
              </h3>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescDirty(true);
                }}
                placeholder="업무 내용을 자세히 적어주세요..."
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
              {descDirty && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={saveDescription}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setDescription(card.description);
                      setDescDirty(false);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    취소
                  </button>
                </div>
              )}
            </section>

            {/* 첨부 */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                첨부
                {attachments.length > 0 && (
                  <span className="ml-2 font-normal text-slate-400">
                    {attachments.length}
                  </span>
                )}
              </h3>
              {attachments.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {attachments.map((att) => (
                    <li
                      key={att.id}
                      className="group flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:border-sky-200 hover:bg-sky-50/40"
                    >
                      <span className="text-base leading-none">
                        {att.type === "link" ? "🔗" : "📄"}
                      </span>
                      <button
                        onClick={() => openAttachment(att)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-sky-700 hover:underline"
                        title={att.type === "link" ? att.url : att.name}
                      >
                        {att.name}
                      </button>
                      <span className="shrink-0 text-xs text-slate-400">
                        {att.type === "link"
                          ? "링크"
                          : formatFileSize(att.size)}
                      </span>
                      <button
                        onClick={() => deleteAttachment(att)}
                        className="hidden rounded px-1.5 text-slate-400 hover:text-red-600 group-hover:block"
                        title="첨부 삭제"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  {uploading ? "업로드 중..." : "📎 파일 첨부"}
                </button>
                <button
                  onClick={() => setAddingLink((v) => !v)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  🔗 링크 추가
                </button>
                <span className="text-xs text-slate-400">최대 10MB</span>
              </div>

              {addingLink && (
                <form
                  onSubmit={handleAddLink}
                  className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3"
                >
                  <input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://... 주소 입력"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                  />
                  <input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="표시 이름 (선택)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingLink(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* 체크리스트 */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                체크리스트
                {checklist.length > 0 && (
                  <span className="ml-2 font-normal text-slate-400">
                    {doneCount}/{checklist.length}
                  </span>
                )}
              </h3>
              {checklist.length > 0 && (
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <ul className="space-y-1">
                {checklist.map((item) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={item.is_done}
                      onChange={() => toggleChecklistItem(item)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.is_done
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {item.content}
                    </span>
                    <button
                      onClick={() => deleteChecklistItem(item.id)}
                      className="hidden rounded px-1.5 text-slate-400 hover:text-red-600 group-hover:block"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={addChecklistItem} className="mt-2 flex gap-2">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="항목 추가..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  추가
                </button>
              </form>
            </section>

            {/* 댓글 */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                댓글
              </h3>
              <form onSubmit={addComment} className="mb-3 flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글 작성..."
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  등록
                </button>
              </form>
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex gap-2.5">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(comment.user_id)}`}
                    >
                      {initial(comment.profiles?.name ?? "")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">
                          {comment.profiles?.name}
                        </span>{" "}
                        · {formatDateTime(comment.created_at)}
                        {comment.user_id === currentUserId && (
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="ml-2 text-slate-300 hover:text-red-500"
                          >
                            삭제
                          </button>
                        )}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                        {comment.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 활동 기록 */}
            <section>
              <button
                onClick={() => setShowActivity((v) => !v)}
                className="mb-2 text-sm font-semibold text-slate-700 hover:text-sky-600"
              >
                활동 기록 {showActivity ? "▾" : "▸"}
              </button>
              {showActivity && (
                <ul className="space-y-2">
                  {activities.length === 0 && (
                    <li className="text-sm text-slate-400">
                      기록이 없습니다.
                    </li>
                  )}
                  {activities.map((activity) => (
                    <li key={activity.id} className="flex gap-2.5 text-sm">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(activity.actor_id ?? "")}`}
                      >
                        {initial(activity.profiles?.name ?? "?")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-slate-600">
                          <span className="font-semibold">
                            {activity.profiles?.name ?? "알 수 없음"}
                          </span>{" "}
                          {activityText(activity.type, activity.data)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDateTime(activity.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 오른쪽 사이드바 */}
          <aside className="space-y-4">
            {/* 담당자 */}
            <div>
              <button
                onClick={() => setShowAssignees((v) => !v)}
                className={sideBtnCls}
              >
                👤 담당자
              </button>
              {showAssignees && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {members.map((m) => {
                    const selected = card.assigneeIds.includes(m.user_id);
                    return (
                      <li key={m.user_id}>
                        <button
                          onClick={() => onToggleAssignee(card.id, m.user_id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                            selected
                              ? "bg-sky-50 font-medium text-sky-700"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(m.user_id)}`}
                          >
                            {initial(m.profiles?.name ?? "")}
                          </span>
                          <span className="flex-1 truncate">
                            {m.profiles?.name}
                          </span>
                          {selected && <span>✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 라벨 */}
            <div>
              <button
                onClick={() => setShowLabels((v) => !v)}
                className={sideBtnCls}
              >
                🏷️ 라벨
              </button>
              {showLabels && (
                <div className="mt-2 rounded-lg border border-slate-200 p-2">
                  <ul className="space-y-1">
                    {labels.map((label) => {
                      const selected = card.labelIds.includes(label.id);
                      return (
                        <li key={label.id} className="group flex items-center gap-1">
                          <button
                            onClick={() => onToggleLabel(card.id, label.id)}
                            className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-white ${labelColor(label.color)} ${
                              selected ? "" : "opacity-50 hover:opacity-80"
                            }`}
                          >
                            <span className="flex-1 truncate">
                              {label.name}
                            </span>
                            {selected && <span>✓</span>}
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `'${label.name}' 라벨을 보드 전체에서 삭제할까요?`
                                )
                              )
                                onDeleteLabel(label.id);
                            }}
                            className="hidden rounded px-1 text-slate-400 hover:text-red-600 group-hover:block"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <form
                    onSubmit={handleCreateLabelSubmit}
                    className="mt-2 border-t border-slate-100 pt-2"
                  >
                    <input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="새 라벨 이름"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-sky-400 focus:outline-none"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {LABEL_COLOR_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewLabelColor(key)}
                          className={`h-5 w-5 rounded ${labelColor(key)} ${
                            newLabelColor === key
                              ? "ring-2 ring-slate-700 ring-offset-1"
                              : "opacity-60 hover:opacity-100"
                          }`}
                          aria-label={key}
                        />
                      ))}
                    </div>
                    <button
                      type="submit"
                      className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      라벨 만들기
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* 상태 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                ⚡ 상태
              </label>
              <select
                value={card.status}
                onChange={(e) =>
                  onUpdateCard(
                    card.id,
                    buildStatusPatch(card, e.target.value as CardStatus)
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                진행으로 바꾸면 시작 시간이, 완료로 바꾸면 종료 시간이 자동
                기록됩니다.
              </p>
            </div>

            {/* 작업 시간 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                🕐 작업 시작
              </label>
              <input
                type="datetime-local"
                value={toLocalInput(card.start_at)}
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    start_at: fromLocalInput(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                🏁 작업 종료
              </label>
              <input
                type="datetime-local"
                value={toLocalInput(card.end_at)}
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    end_at: fromLocalInput(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
              />
            </div>

            {/* 마감일 */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                📅 마감일
              </label>
              <input
                type="date"
                value={card.due_date ?? ""}
                onChange={(e) =>
                  onUpdateCard(card.id, {
                    due_date: e.target.value || null,
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
              />
              {card.due_date && (
                <button
                  onClick={() => onUpdateCard(card.id, { due_date: null })}
                  className="mt-1 text-xs text-slate-400 hover:text-red-500"
                >
                  마감일 제거
                </button>
              )}
            </div>

            {/* 카드 삭제 */}
            <button
              onClick={() => {
                if (confirm("이 카드를 삭제할까요?")) onDeleteCard(card.id);
              }}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              카드 삭제
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
