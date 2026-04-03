-- ============================================
-- Vibelive 直播表 (live_streams)
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

create table public.live_streams (
  id uuid primary key default gen_random_uuid(),
  room_name text unique not null,
  user_id uuid references auth.users(id) on delete cascade,
  streamer_name text not null,
  title text default '',
  coding_tool text default 'other',
  status text default 'live' check (status in ('live', 'away', 'offline')),
  viewers_count int default 0,
  started_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.live_streams enable row level security;

-- 所有人可查看
create policy "Live streams are viewable by everyone"
  on public.live_streams for select
  using (true);

-- 登录用户可以创建自己的直播
create policy "Authenticated users can create streams"
  on public.live_streams for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 用户只能更新/删除自己的直播
create policy "Users can update own streams"
  on public.live_streams for update
  using (auth.uid() = user_id);

create policy "Users can delete own streams"
  on public.live_streams for delete
  using (auth.uid() = user_id);

-- 自动更新 updated_at
create trigger on_live_stream_updated
  before update on public.live_streams
  for each row execute function public.handle_updated_at();
