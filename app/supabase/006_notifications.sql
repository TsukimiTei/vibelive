-- ============================================
-- 通知中心
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 通知表
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,   -- 通知接收者
  type text not null check (type in ('follow', 'stream_live', 'favorite')),
  actor_id uuid references auth.users(id) on delete cascade,            -- 触发者
  actor_name text default '',                                            -- 触发者名称（冗余，避免 join）
  actor_avatar text default '',                                          -- 触发者头像
  target_id text default '',                                             -- 相关目标（如 room_name）
  target_title text default '',                                          -- 目标标题
  read_at timestamptz,
  created_at timestamptz default now()
);

create index idx_notifications_user_id on public.notifications(user_id, created_at desc);

-- 2. RLS
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- 允许触发器和 service role 插入
create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);

-- 3. 关注时自动通知
create or replace function public.notify_on_follow()
returns trigger as $$
declare
  follower_profile record;
begin
  select display_name, avatar_url into follower_profile
    from public.profiles where id = new.follower_id;

  insert into public.notifications (user_id, type, actor_id, actor_name, actor_avatar)
  values (
    new.following_id,
    'follow',
    new.follower_id,
    coalesce(follower_profile.display_name, '用户'),
    coalesce(follower_profile.avatar_url, '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_new_follow_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- 4. 收藏时自动通知主播
create or replace function public.notify_on_favorite()
returns trigger as $$
declare
  fav_profile record;
  stream_record record;
begin
  select display_name, avatar_url into fav_profile
    from public.profiles where id = new.user_id;

  -- 找到对应直播的主播
  select user_id, title, project_name into stream_record
    from public.live_streams
    where room_name = new.room_name
    order by started_at desc limit 1;

  -- 不通知自己收藏自己
  if stream_record.user_id is not null and stream_record.user_id != new.user_id then
    insert into public.notifications (user_id, type, actor_id, actor_name, actor_avatar, target_id, target_title)
    values (
      stream_record.user_id,
      'favorite',
      new.user_id,
      coalesce(fav_profile.display_name, '用户'),
      coalesce(fav_profile.avatar_url, ''),
      new.room_name,
      coalesce(stream_record.project_name, stream_record.title, new.room_name)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_new_favorite_notify
  after insert on public.favorites
  for each row execute function public.notify_on_favorite();
