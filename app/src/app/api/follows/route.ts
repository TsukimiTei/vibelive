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

  // Get all follows with profile info
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

  const { following_id } = await request.json();
  if (!following_id) return Response.json({ error: "missing following_id" }, { status: 400 });

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

  const { following_id } = await request.json();

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", following_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
