-- ============================================
-- Vibelive 用户表 (profiles)
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 创建 profiles 表
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  email text,
  avatar_url text,
  bio text default '',
  role text default 'viewer' check (role in ('viewer', 'streamer', 'admin')),
  followers_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 启用 RLS
alter table public.profiles enable row level security;

-- 3. RLS 策略：所有人可查看 profile
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- 4. RLS 策略：用户只能更新自己的 profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 5. RLS 策略：用户可以插入自己的 profile
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 6. 自动创建 profile 的触发器函数
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'preferred_username',
      new.raw_user_meta_data ->> 'user_name',
      'user_' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 7. 绑定触发器到 auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. 自动更新 updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();
