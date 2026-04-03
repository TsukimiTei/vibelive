-- ============================================
-- 给 live_streams 增加项目信息字段
-- 在 Supabase SQL Editor 中执行
-- ============================================

alter table public.live_streams
  add column if not exists project_name text default '',
  add column if not exists description text default '',
  add column if not exists stage text default '构思中';
