-- ============================================================
-- 마감 임박 알림 (D-7 / D-1 / 당일)
-- schema.sql, notifications.sql, card-status.sql 실행 후 추가로 실행하세요.
--
-- 매일 오전 9시(KST)에 pg_cron 이 돌면서
-- 마감이 7일 / 1일 / 0일 남은 카드의 담당자에게 알림을 만든다.
-- 담당자가 없으면 카드를 만든 사람에게 보낸다.
-- ============================================================

create extension if not exists pg_cron;

create or replace function public.notify_due_soon()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer := 0;
  v_inserted integer;
begin
  for r in
    -- 담당자가 있으면 담당자 전원, 없으면 카드 생성자
    select
      c.id            as card_id,
      c.board_id      as board_id,
      c.title         as card_title,
      c.due_date      as due_date,
      b.title         as board_title,
      (c.due_date - v_today) as days_left,
      coalesce(
        nullif(array(select ca.user_id from card_assignees ca where ca.card_id = c.id), '{}'),
        array(select c.created_by where c.created_by is not null)
      ) as recipients
    from cards c
    join boards b on b.id = c.board_id
    where c.due_date is not null
      and c.status <> 'done'
      and (c.due_date - v_today) in (7, 1, 0)
  loop
    insert into notifications (user_id, actor_id, type, card_id, board_id, data)
    select
      u, null, 'due_soon', r.card_id, r.board_id,
      jsonb_build_object(
        'card_title', r.card_title,
        'board_title', r.board_title,
        'days_left', r.days_left::text,
        'due_date', r.due_date::text
      )
    from unnest(r.recipients) as u
    -- 같은 카드·같은 D-day 로는 한 번만 보낸다
    where not exists (
      select 1 from notifications n
      where n.user_id = u
        and n.card_id = r.card_id
        and n.type = 'due_soon'
        and n.data->>'days_left' = r.days_left::text
    );

    -- 실제로 새로 만들어진 알림만 센다 (중복 건너뛴 건 제외)
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;

  return v_count;
end;
$$;

-- 매일 00:00 UTC = 09:00 KST
select cron.unschedule('notify-due-soon')
where exists (select 1 from cron.job where jobname = 'notify-due-soon');

select cron.schedule(
  'notify-due-soon',
  '0 0 * * *',
  $$select public.notify_due_soon()$$
);
