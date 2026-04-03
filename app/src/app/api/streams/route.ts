import { NextRequest } from "next/server";
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

  const { room_name, title, coding_tool } = await request.json();

  if (!room_name) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  // Upsert: 如果已有记录则更新状态为 live
  const { data, error } = await supabase
    .from("live_streams")
    .upsert(
      {
        room_name,
        user_id: user.id,
        streamer_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "匿名",
        title: title || "",
        coding_tool: coding_tool || "other",
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

  const { room_name, project_name, description, stage, coding_tool } = await request.json();

  if (!room_name) {
    return Response.json({ error: "room_name 为必填项" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (project_name !== undefined) updates.project_name = project_name;
  if (description !== undefined) updates.description = description;
  if (stage !== undefined) updates.stage = stage;
  if (coding_tool !== undefined) updates.coding_tool = coding_tool;

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

  const { room_name } = await request.json();

  const { error } = await supabase
    .from("live_streams")
    .delete()
    .eq("room_name", room_name)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
