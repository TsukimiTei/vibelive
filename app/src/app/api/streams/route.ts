import { NextRequest } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

// GET: 获取活跃直播，或查询用户历史直播
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ streams: [] });
  }

  const history = request.nextUrl.searchParams.get("history");

  // 查询当前登录用户的历史直播（需要鉴权）
  if (history) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ streams: [] });
    const { data, error } = await supabase
      .from("live_streams")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ streams: data ?? [] });
  }

  // 默认：获取所有活跃直播
  const { data, error } = await supabase
    .from("live_streams")
    .select("*")
    .eq("status", "live")
    .order("started_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ streams: data ?? [] });
}

// POST: 注册新直播
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "服务未配置" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let body: { room_name?: string; title?: string; coding_tool?: string; thumbnail_url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const { room_name, title, coding_tool, thumbnail_url } = body;

  if (!room_name || room_name.length > 60) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  // Check if this room_name is already live by another user
  const { data: existing } = await supabase
    .from("live_streams")
    .select("user_id")
    .eq("room_name", room_name)
    .eq("status", "live")
    .maybeSingle();

  if (existing && existing.user_id !== user.id) {
    return Response.json({ error: "该房间名已被其他用户占用" }, { status: 409 });
  }

  // End any existing live stream by this user (one live stream per user)
  await supabase
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "live");

  // Insert new stream record
  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      room_name,
      user_id: user.id,
      streamer_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "匿名",
      title: (title || "").slice(0, 200),
      coding_tool: (coding_tool || "other").slice(0, 30),
      thumbnail_url: (thumbnail_url || "").slice(0, 500),
      status: "live",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Notify followers that this user went live (fire and forget)
  const streamerName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "匿名";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", user.id)
    .then(({ data: followers }) => {
      if (!followers?.length) return;
      const notifications = followers.map((f) => ({
        user_id: f.follower_id,
        type: "stream_live",
        actor_id: user.id,
        actor_name: streamerName,
        actor_avatar: avatarUrl,
        target_id: room_name,
        target_title: (title || room_name).slice(0, 200),
      }));
      supabase.from("notifications").insert(notifications).then(() => {});
    });

  return Response.json({ stream: data });
}

// PATCH: 更新直播间项目信息（含封面图）
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "服务未配置" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let patchBody: Record<string, string | undefined>;
  try {
    patchBody = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const { room_name, project_name, description, stage, coding_tool, thumbnail_url } = patchBody;

  if (!room_name) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (project_name !== undefined) updates.project_name = project_name.slice(0, 200);
  if (description !== undefined) updates.description = description.slice(0, 1000);
  if (stage !== undefined) updates.stage = stage.slice(0, 30);
  if (coding_tool !== undefined) updates.coding_tool = coding_tool.slice(0, 30);
  if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url.slice(0, 500);

  const { data, error } = await supabase
    .from("live_streams")
    .update(updates)
    .eq("room_name", room_name)
    .eq("user_id", user.id)
    .eq("status", "live")
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ stream: data });
}

// DELETE: 结束直播（标记为 ended，保留历史记录）
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ error: "服务未配置" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let delBody: { room_name?: string };
  try {
    delBody = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const { room_name: del_room_name } = delBody;
  if (!del_room_name) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  // Mark as ended instead of deleting
  const { error } = await supabase
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("room_name", del_room_name)
    .eq("user_id", user.id)
    .eq("status", "live");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Also delete the LiveKit room to disconnect all participants
  const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const lkKey = process.env.LIVEKIT_API_KEY;
  const lkSecret = process.env.LIVEKIT_API_SECRET;
  if (lkUrl && lkKey && lkSecret) {
    const roomService = new RoomServiceClient(lkUrl, lkKey, lkSecret);
    roomService.deleteRoom(del_room_name).catch(() => {});
  }

  return Response.json({ ok: true });
}
