-- ============================================
-- 直播封面图 + 历史记录支持
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 新增字段
alter table public.live_streams
  add column if not exists thumbnail_url text default '',
  add column if not exists ended_at timestamptz;

-- 2. 更新 status 约束，增加 'ended' 状态
alter table public.live_streams drop constraint if exists live_streams_status_check;
alter table public.live_streams
  add constraint live_streams_status_check
  check (status in ('live', 'away', 'offline', 'ended'));

-- 3. 替换 room_name 唯一约束为部分唯一索引（仅 live 状态时唯一）
alter table public.live_streams drop constraint if exists live_streams_room_name_key;
create unique index if not exists live_streams_room_name_live_unique
  on public.live_streams(room_name) where status = 'live';

-- 4. Storage policies for thumbnails bucket
create policy "Public read thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

create policy "Authenticated upload thumbnails"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'thumbnails');

create policy "Authenticated update thumbnails"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'thumbnails');

create policy "Authenticated delete thumbnails"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'thumbnails');
