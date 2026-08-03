-- ============================================================
-- 알림 기능 (schema.sql 실행 후 추가로 실행)
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 알림 테이블
-- ------------------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,   -- 수신자
  actor_id uuid references public.profiles (id) on delete set null,          -- 행위자
  type text not null,                 -- 'assigned' | 'card_moved'
  card_id uuid references public.cards (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  data jsonb not null default '{}',   -- 표시용 스냅샷 (card_title, board_title, from, to, actor_name)
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications (user_id, is_read, created_at desc);

-- ------------------------------------------------------------
-- 2. RLS — 본인 알림만 조회/읽음처리/삭제 (생성은 트리거만)
-- ------------------------------------------------------------

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid());
create policy "notifications_delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. 트리거: 담당자로 지정되면 알림
-- ------------------------------------------------------------

create or replace function public.notify_assignee_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_card cards%rowtype;
  v_board_title text;
  v_actor_name text;
begin
  -- 본인이 본인을 지정한 경우 알림 없음
  if new.user_id = auth.uid() then
    return new;
  end if;

  select * into v_card from cards where id = new.card_id;
  if not found then
    return new;
  end if;
  select title into v_board_title from boards where id = v_card.board_id;
  select name into v_actor_name from profiles where id = auth.uid();

  insert into notifications (user_id, actor_id, type, card_id, board_id, data)
  values (
    new.user_id, auth.uid(), 'assigned', new.card_id, v_card.board_id,
    jsonb_build_object(
      'card_title', v_card.title,
      'board_title', coalesce(v_board_title, '?'),
      'actor_name', coalesce(v_actor_name, '?')
    )
  );
  return new;
end;
$$;

create trigger trg_notify_assignee_added
  after insert on public.card_assignees
  for each row execute function public.notify_assignee_added();

-- ------------------------------------------------------------
-- 4. 트리거: 내가 담당한 카드가 다른 리스트로 이동되면 알림
-- ------------------------------------------------------------

create or replace function public.notify_card_moved()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_from text;
  v_to text;
  v_board_title text;
  v_actor_name text;
  r record;
begin
  if old.list_id is distinct from new.list_id then
    select title into v_from from lists where id = old.list_id;
    select title into v_to from lists where id = new.list_id;
    select title into v_board_title from boards where id = new.board_id;
    select name into v_actor_name from profiles where id = auth.uid();

    for r in
      select user_id from card_assignees
      where card_id = new.id
        and user_id is distinct from auth.uid()   -- 옮긴 본인은 제외
    loop
      insert into notifications (user_id, actor_id, type, card_id, board_id, data)
      values (
        r.user_id, auth.uid(), 'card_moved', new.id, new.board_id,
        jsonb_build_object(
          'card_title', new.title,
          'board_title', coalesce(v_board_title, '?'),
          'from', coalesce(v_from, '?'),
          'to', coalesce(v_to, '?'),
          'actor_name', coalesce(v_actor_name, '?')
        )
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_notify_card_moved
  after update on public.cards
  for each row execute function public.notify_card_moved();

-- ------------------------------------------------------------
-- 5. 실시간 — 새 알림이 즉시 종 배지에 반영되도록
-- ------------------------------------------------------------

alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
