import { NextRequest } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

// GET: 获取所有活跃直播
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json({ streams: [] });
  }

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

  let body: { room_name?: string; title?: string; coding_tool?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const { room_name, title, coding_tool } = body;

  if (!room_name || room_name.length > 60) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  // Check if a stream with this room_name already belongs to a different user
  const { data: existing } = await supabase
    .from("live_streams")
    .select("user_id")
    .eq("room_name", room_name)
    .maybeSingle();

  if (existing && existing.user_id !== user.id) {
    return Response.json({ error: "该房间名已被其他用户占用" }, { status: 409 });
  }

  // Upsert: 如果已有记录则更新状态为 live
  const { data, error } = await supabase
    .from("live_streams")
    .upsert(
      {
        room_name,
        user_id: user.id,
        streamer_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "匿名",
        title: (title || "").slice(0, 200),
        coding_tool: (coding_tool || "other").slice(0, 30),
        status: "live",
        started_at: new Date().toISOString(),
      },
      { onConflict: "room_name" }
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ stream: data });
}

// PATCH: 更新直播间项目信息
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
  const { room_name, project_name, description, stage, coding_tool } = patchBody;

  if (!room_name) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (project_name !== undefined) updates.project_name = project_name.slice(0, 200);
  if (description !== undefined) updates.description = description.slice(0, 1000);
  if (stage !== undefined) updates.stage = stage.slice(0, 30);
  if (coding_tool !== undefined) updates.coding_tool = coding_tool.slice(0, 30);

  const { data, error } = await supabase
    .from("live_streams")
    .update(updates)
    .eq("room_name", room_name)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ stream: data });
}

// DELETE: 结束直播
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

  const { error } = await supabase
    .from("live_streams")
    .delete()
    .eq("room_name", del_room_name)
    .eq("user_id", user.id);

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
