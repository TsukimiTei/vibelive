import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: 获取当前用户的收藏列表，或查询是否收藏了某直播间
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ favorites: [] });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ favorites: [] });

  const roomName = request.nextUrl.searchParams.get("room_name");

  if (roomName) {
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("room_name", roomName)
      .maybeSingle();
    return Response.json({ isFavorited: !!data });
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ favorites: data ?? [] });
}

// POST: 收藏
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "服务未配置" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  let body: { room_name?: string; stream_title?: string; streamer_name?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
  const { room_name, stream_title, streamer_name } = body;
  if (!room_name) return Response.json({ error: "room_name 为必填项" }, { status: 400 });

  const { error } = await supabase
    .from("favorites")
    .insert({
      user_id: user.id,
      room_name: room_name.slice(0, 60),
      stream_title: (stream_title || "").slice(0, 200),
      streamer_name: (streamer_name || "").slice(0, 60),
    });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE: 取消收藏
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "服务未配置" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  let delBody: { room_name?: string };
  try { delBody = await request.json(); } catch { return Response.json({ error: "请求格式错误" }, { status: 400 }); }
  const { room_name: del_room } = delBody;
  if (!del_room) return Response.json({ error: "room_name 为必填项" }, { status: 400 });

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("room_name", del_room);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
