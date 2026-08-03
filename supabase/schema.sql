-- ============================================================
-- 업무보드 (Trello-style task board) — Supabase schema
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

-- 사용자 프로필 (auth.users 와 1:1, 가입 시 트리거로 자동 생성)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

-- 조직
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- 초대 수락을 허용할 이메일 도메인 목록. null 또는 빈 배열이면 제한 없음.
  allowed_domains text[],
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 조직 멤버십 (한 사람이 여러 조직에 소속 가능)
create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- 초대 링크
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  role text not null default 'member' check (role in ('admin', 'member')),
  max_uses int,                       -- null = 무제한
  used_count int not null default 0,
  expires_at timestamptz,             -- null = 무기한
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 보드
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  color text not null default 'sky',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 리스트 (보드의 컬럼)
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null,
  position double precision not null,
  created_at timestamptz not null default now()
);

-- 카드 (board_id 를 중복 저장해 실시간 필터/권한 검사를 단순화)
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null,
  description text not null default '',
  position double precision not null,
  due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 라벨 (보드 단위)
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  color text not null default 'gray'
);

create table public.card_labels (
  card_id uuid not null references public.cards (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (card_id, label_id)
);

-- 카드 담당자
create table public.card_assignees (
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

-- 댓글
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- 체크리스트
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  position double precision not null,
  created_at timestamptz not null default now()
);

-- 업무 히스토리 (트리거로 자동 기록)
create table public.activities (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  type text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_members_user on public.organization_members (user_id);
create index idx_boards_org on public.boards (org_id);
create index idx_lists_board on public.lists (board_id);
create index idx_cards_board on public.cards (board_id);
create index idx_cards_list on public.cards (list_id);
create index idx_comments_card on public.comments (card_id);
create index idx_checklist_card on public.checklist_items (card_id);
create index idx_activities_card on public.activities (card_id);
create index idx_invites_org on public.invites (org_id);

-- ------------------------------------------------------------
-- 2. 가입 시 프로필 자동 생성
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. 권한 헬퍼 함수 (RLS 재귀 방지를 위해 security definer)
-- ------------------------------------------------------------

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function public.org_role(p_org uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select role from organization_members
  where org_id = p_org and user_id = auth.uid();
$$;

create or replace function public.is_board_member(p_board uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from boards b
    join organization_members m on m.org_id = b.org_id
    where b.id = p_board and m.user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 4. RLS 정책
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security;
alter table public.boards enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.labels enable row level security;
alter table public.card_labels enable row level security;
alter table public.card_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.checklist_items enable row level security;
alter table public.activities enable row level security;

-- 프로필: 로그인 사용자는 조회 가능(이름/이메일 표시용), 본인 것만 수정
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- 조직: 멤버만 조회, 생성은 RPC(create_organization) 사용
create policy "orgs_select" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "orgs_update" on public.organizations
  for update to authenticated using (public.org_role(id) in ('owner', 'admin'));
create policy "orgs_delete" on public.organizations
  for delete to authenticated using (public.org_role(id) = 'owner');

-- 멤버십: 같은 조직 멤버만 조회. 추가는 RPC(초대 수락/조직 생성)로만.
create policy "members_select" on public.organization_members
  for select to authenticated using (public.is_org_member(org_id));
create policy "members_update" on public.organization_members
  for update to authenticated
  using (public.org_role(org_id) = 'owner' and role <> 'owner');
create policy "members_delete" on public.organization_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = auth.uid() or public.org_role(org_id) in ('owner', 'admin'))
  );

-- 초대: 조직장/관리자만 관리
create policy "invites_select" on public.invites
  for select to authenticated using (public.org_role(org_id) in ('owner', 'admin'));
create policy "invites_insert" on public.invites
  for insert to authenticated
  with check (public.org_role(org_id) in ('owner', 'admin') and created_by = auth.uid());
create policy "invites_delete" on public.invites
  for delete to authenticated using (public.org_role(org_id) in ('owner', 'admin'));

-- 보드: 조직 멤버 전체 읽기/쓰기
create policy "boards_select" on public.boards
  for select to authenticated using (public.is_org_member(org_id));
create policy "boards_insert" on public.boards
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "boards_update" on public.boards
  for update to authenticated using (public.is_org_member(org_id));
create policy "boards_delete" on public.boards
  for delete to authenticated using (public.is_org_member(org_id));

-- 리스트/카드/라벨: 보드가 속한 조직의 멤버
create policy "lists_all" on public.lists
  for all to authenticated
  using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

create policy "cards_all" on public.cards
  for all to authenticated
  using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

create policy "labels_all" on public.labels
  for all to authenticated
  using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

create policy "card_labels_all" on public.card_labels
  for all to authenticated
  using (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)))
  with check (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)));

create policy "card_assignees_all" on public.card_assignees
  for all to authenticated
  using (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)))
  with check (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)));

-- 댓글: 보드 멤버 조회/작성, 본인 것만 수정·삭제
create policy "comments_select" on public.comments
  for select to authenticated
  using (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)));
create policy "comments_insert" on public.comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id))
  );
create policy "comments_update" on public.comments
  for update to authenticated using (user_id = auth.uid());
create policy "comments_delete" on public.comments
  for delete to authenticated using (user_id = auth.uid());

create policy "checklist_all" on public.checklist_items
  for all to authenticated
  using (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)))
  with check (exists (select 1 from cards c where c.id = card_id and public.is_board_member(c.board_id)));

-- 활동 로그: 보드 멤버 조회만 (기록은 트리거가 수행)
create policy "activities_select" on public.activities
  for select to authenticated using (public.is_board_member(board_id));

-- ------------------------------------------------------------
-- 5. RPC 함수
-- ------------------------------------------------------------

-- 조직 생성 (+ 생성자를 owner 로 등록)
create or replace function public.create_organization(p_name text, p_domains text[] default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_domains text[];
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  -- 도메인 정규화: 소문자, 공백/@ 제거, 빈 값 제외
  select array_agg(d) into v_domains
  from (
    select lower(trim(both ' @' from x)) as d
    from unnest(coalesce(p_domains, '{}')) x
    where trim(both ' @' from x) <> ''
  ) t;

  insert into organizations (name, allowed_domains, created_by)
  values (trim(p_name), v_domains, auth.uid())
  returning id into v_id;

  insert into organization_members (org_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$$;

-- 초대 링크 정보 조회 (로그인 전에도 조직 이름을 보여주기 위해 anon 허용)
create or replace function public.get_invite_info(p_token text)
returns table (org_id uuid, org_name text, allowed_domains text[], status text)
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_invite invites%rowtype;
  v_org organizations%rowtype;
begin
  select * into v_invite from invites where token = p_token;
  if not found then
    return query select null::uuid, null::text, null::text[], 'NOT_FOUND'::text;
    return;
  end if;

  select * into v_org from organizations where id = v_invite.org_id;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return query select v_org.id, v_org.name, v_org.allowed_domains, 'EXPIRED'::text;
  elsif v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    return query select v_org.id, v_org.name, v_org.allowed_domains, 'EXHAUSTED'::text;
  else
    return query select v_org.id, v_org.name, v_org.allowed_domains, 'VALID'::text;
  end if;
end;
$$;

-- 초대 수락: 토큰 검증 + 이메일 도메인 검증 + 멤버 등록
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite invites%rowtype;
  v_domains text[];
  v_email text;
  v_domain text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_invite from invites where token = p_token;
  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'INVITE_EXHAUSTED';
  end if;

  -- 이미 멤버면 그대로 통과
  if exists (
    select 1 from organization_members
    where org_id = v_invite.org_id and user_id = auth.uid()
  ) then
    return v_invite.org_id;
  end if;

  -- 이메일 도메인 제한 검사
  select allowed_domains into v_domains from organizations where id = v_invite.org_id;
  if v_domains is not null and array_length(v_domains, 1) > 0 then
    select email into v_email from profiles where id = auth.uid();
    v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));
    if not exists (select 1 from unnest(v_domains) d where lower(d) = v_domain) then
      raise exception 'DOMAIN_NOT_ALLOWED';
    end if;
  end if;

  insert into organization_members (org_id, user_id, role)
  values (v_invite.org_id, auth.uid(), v_invite.role);

  update invites set used_count = used_count + 1 where id = v_invite.id;

  return v_invite.org_id;
end;
$$;

-- ------------------------------------------------------------
-- 6. 업무 히스토리 트리거
-- ------------------------------------------------------------

create or replace function public.log_card_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activities (board_id, card_id, actor_id, type, data)
  values (new.board_id, new.id, auth.uid(), 'card_created', jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger trg_card_created
  after insert on public.cards
  for each row execute function public.log_card_created();

create or replace function public.log_card_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_from text;
  v_to text;
begin
  if old.list_id is distinct from new.list_id then
    select title into v_from from lists where id = old.list_id;
    select title into v_to from lists where id = new.list_id;
    insert into activities (board_id, card_id, actor_id, type, data)
    values (new.board_id, new.id, auth.uid(), 'card_moved',
            jsonb_build_object('from', coalesce(v_from, '?'), 'to', coalesce(v_to, '?')));
  end if;
  if old.due_date is distinct from new.due_date then
    insert into activities (board_id, card_id, actor_id, type, data)
    values (new.board_id, new.id, auth.uid(), 'due_date_changed',
            jsonb_build_object('due_date', new.due_date));
  end if;
  return new;
end;
$$;

create trigger trg_card_updated
  after update on public.cards
  for each row execute function public.log_card_updated();

create or replace function public.log_assignee_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_board uuid;
  v_name text;
begin
  select board_id into v_board from cards where id = new.card_id;
  select name into v_name from profiles where id = new.user_id;
  insert into activities (board_id, card_id, actor_id, type, data)
  values (v_board, new.card_id, auth.uid(), 'assignee_added',
          jsonb_build_object('user_name', coalesce(v_name, '?')));
  return new;
end;
$$;

create trigger trg_assignee_added
  after insert on public.card_assignees
  for each row execute function public.log_assignee_added();

create or replace function public.log_assignee_removed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_board uuid;
  v_name text;
begin
  select board_id into v_board from cards where id = old.card_id;
  if v_board is null then
    return old; -- 카드 삭제 cascade 중이면 기록 생략
  end if;
  select name into v_name from profiles where id = old.user_id;
  insert into activities (board_id, card_id, actor_id, type, data)
  values (v_board, old.card_id, auth.uid(), 'assignee_removed',
          jsonb_build_object('user_name', coalesce(v_name, '?')));
  return old;
end;
$$;

create trigger trg_assignee_removed
  after delete on public.card_assignees
  for each row execute function public.log_assignee_removed();

-- ------------------------------------------------------------
-- 7. 실시간 (Realtime)
-- ------------------------------------------------------------

-- DELETE/필터 이벤트가 올바르게 전달되도록 replica identity 를 full 로 설정
alter table public.lists replica identity full;
alter table public.cards replica identity full;
alter table public.card_assignees replica identity full;
alter table public.card_labels replica identity full;

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.card_assignees;
alter publication supabase_realtime add table public.card_labels;
