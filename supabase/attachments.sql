-- ============================================================
-- 카드 첨부 (파일 + 링크) — schema.sql 실행 후 추가로 실행
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 실행하세요.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 첨부 테이블 (파일과 링크 공용)
-- ------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  type text not null check (type in ('file', 'link')),
  name text not null,          -- 표시 이름 (원본 파일명 또는 링크 제목)
  url text not null,           -- file: 스토리지 경로, link: 외부 URL
  size bigint,                 -- file: 바이트 수
  mime_type text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_attachments_card on public.attachments (card_id);

alter table public.attachments enable row level security;

create policy "attachments_select" on public.attachments
  for select to authenticated using (public.is_board_member(board_id));
create policy "attachments_insert" on public.attachments
  for insert to authenticated
  with check (public.is_board_member(board_id) and created_by = auth.uid());
create policy "attachments_delete" on public.attachments
  for delete to authenticated using (public.is_board_member(board_id));

-- ------------------------------------------------------------
-- 2. 활동 기록: 첨부 추가 시
-- ------------------------------------------------------------

create or replace function public.log_attachment_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into activities (board_id, card_id, actor_id, type, data)
  values (new.board_id, new.card_id, auth.uid(), 'attachment_added',
          jsonb_build_object('name', new.name, 'attachment_type', new.type));
  return new;
end;
$$;

create trigger trg_attachment_added
  after insert on public.attachments
  for each row execute function public.log_attachment_added();

-- ------------------------------------------------------------
-- 3. 스토리지 버킷 (비공개, 10MB 제한)
--    파일 경로 규칙: <board_id>/<card_id>/<uuid>.<확장자>
--    → 첫 번째 폴더(board_id)로 보드 멤버만 접근하도록 제한
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

create policy "attachments_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_board_member(((storage.foldername(name))[1])::uuid)
  );

create policy "attachments_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_board_member(((storage.foldername(name))[1])::uuid)
  );

create policy "attachments_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_board_member(((storage.foldername(name))[1])::uuid)
  );
