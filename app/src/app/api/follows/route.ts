import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 获取当前用户的关注列表，或查询是否关注了某人
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ follows: [] });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ follows: [] });

  const followingId = request.nextUrl.searchParams.get("following_id");

  if (followingId) {
    // Check if following a specific user
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", followingId)
      .maybeSingle();
    return Response.json({ isFollowing: !!data });
  }

  const type = request.nextUrl.searchParams.get("type");

  if (type === "followers") {
    // Get people who follow me
    const { data, error } = await supabase
      .from("follows")
      .select("*, profiles:follower_id(id, display_name, avatar_url, username, bio, followers_count)")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ followers: data ?? [] });
  }

  // Default: get people I follow
  const { data, error } = await supabase
    .from("follows")
    .select("*, profiles:following_id(id, display_name, avatar_url, username, bio, followers_count)")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ follows: data ?? [] });
}

// POST: 关注
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "服务未配置" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  let body: { following_id?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
  const { following_id } = body;
  if (!following_id) return Response.json({ error: "following_id 为必填项" }, { status: 400 });
  if (following_id === user.id) return Response.json({ error: "不能关注自己" }, { status: 400 });

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE: 取消关注
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "服务未配置" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  let delBody: { following_id?: string };
  try { delBody = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
  const { following_id: del_fid } = delBody;
  if (!del_fid) return Response.json({ error: "following_id 为必填项" }, { status: 400 });

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", del_fid);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
