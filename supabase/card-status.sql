-- ============================================================
-- 카드 상태(준비/진행/완료) + 작업 시작/종료 시간
-- schema.sql, notifications.sql 실행 후 추가로 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1. cards 컬럼 추가
-- ------------------------------------------------------------

alter table public.cards
  add column status text not null default 'ready'
    check (status in ('ready', 'in_progress', 'done')),
  add column start_at timestamptz,
  add column end_at timestamptz;

create index idx_cards_status on public.cards (status);

-- ------------------------------------------------------------
-- 2. 활동 기록 트리거 확장: 상태 변경도 기록
-- ------------------------------------------------------------

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
  if old.status is distinct from new.status then
    insert into activities (board_id, card_id, actor_id, type, data)
    values (new.board_id, new.id, auth.uid(), 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. 알림 트리거 확장: 담당자에게 상태 변경 알림
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
        and user_id is distinct from auth.uid()
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

  if old.status is distinct from new.status then
    select title into v_board_title from boards where id = new.board_id;
    select name into v_actor_name from profiles where id = auth.uid();

    for r in
      select user_id from card_assignees
      where card_id = new.id
        and user_id is distinct from auth.uid()
    loop
      insert into notifications (user_id, actor_id, type, card_id, board_id, data)
      values (
        r.user_id, auth.uid(), 'status_changed', new.id, new.board_id,
        jsonb_build_object(
          'card_title', new.title,
          'board_title', coalesce(v_board_title, '?'),
          'from', old.status,
          'to', new.status,
          'actor_name', coalesce(v_actor_name, '?')
        )
      );
    end loop;
  end if;

  return new;
end;
$$;
