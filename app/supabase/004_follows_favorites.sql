-- ============================================
-- 关注 + 收藏表
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 关注表
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

alter table public.follows enable row level security;

create policy "Anyone can view follows"
  on public.follows for select using (true);

create policy "Users can follow"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- 2. 收藏表
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  stream_title text default '',
  streamer_name text default '',
  created_at timestamptz default now(),
  unique(user_id, room_name)
);

alter table public.favorites enable row level security;

create policy "Anyone can view favorites"
  on public.favorites for select using (true);

create policy "Users can favorite"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unfavorite"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- 3. 更新 profiles 的 followers_count 触发器
create or replace function public.update_followers_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles set followers_count = followers_count - 1 where id = old.following_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_follow_change
  after insert or delete on public.follows
  for each row execute function public.update_followers_count();
