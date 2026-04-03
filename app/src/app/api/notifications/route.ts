import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 获取当前用户的通知
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ notifications: [] });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ notifications: [] });

  const unreadOnly = request.nextUrl.searchParams.get("unread");

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Also return unread count
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return Response.json({
    notifications: data ?? [],
    unread_count: count ?? 0,
  });
}

// PATCH: 标记通知为已读
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "服务未配置" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  let body: { id?: string; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.all) {
    // 全部已读
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  } else if (body.id) {
    // 单条已读
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("user_id", user.id);
  } else {
    return Response.json({ error: "需要 id 或 all 参数" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
