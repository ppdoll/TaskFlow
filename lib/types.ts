export type Role = "owner" | "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  allowed_domains: string[] | null;
  created_by: string;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profiles: Profile;
}

export interface Invite {
  id: string;
  org_id: string;
  token: string;
  role: "admin" | "member";
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface Board {
  id: string;
  org_id: string;
  title: string;
  color: string;
  created_at: string;
}

export interface List {
  id: string;
  board_id: string;
  title: string;
  position: number;
}

export type CardStatus = "ready" | "in_progress" | "done";

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  due_date: string | null;
  status: CardStatus;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  created_at: string;
  /** 클라이언트 상태에서만 사용 */
  assigneeIds: string[];
  labelIds: string[];
  attachmentCount: number;
}

export interface Attachment {
  id: string;
  card_id: string;
  board_id: string;
  type: "file" | "link";
  name: string;
  url: string;
  size: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface CommentRow {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { name: string } | null;
}

export interface ChecklistItem {
  id: string;
  card_id: string;
  content: string;
  is_done: boolean;
  position: number;
}

export interface Notification {
  id: number;
  user_id: string;
  actor_id: string | null;
  type: string;
  card_id: string | null;
  board_id: string;
  data: Record<string, string | null>;
  is_read: boolean;
  created_at: string;
}

export interface Activity {
  id: number;
  board_id: string;
  card_id: string | null;
  actor_id: string | null;
  type: string;
  data: Record<string, string | null>;
  created_at: string;
  profiles: { name: string } | null;
}
