import { AccessToken } from "livekit-server-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_IDENTITY_LEN = 30;
const MAX_ROOM_LEN = 60;

export async function POST(request: NextRequest) {
  let body: { room?: string; identity?: string; isPublisher?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { room, identity, isPublisher } = body;

  if (!room || typeof room !== "string" || room.length > MAX_ROOM_LEN) {
    return Response.json({ error: "room 无效" }, { status: 400 });
  }

  // Publisher tokens: require auth, derive identity from user profile (ignore client identity)
  let resolvedIdentity: string;
  let canPublish = false;

  if (isPublisher) {
    const supabase = await createClient();
    if (!supabase) {
      return Response.json({ error: "服务未配置" }, { status: 500 });
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "开播需要登录" }, { status: 401 });
    }
    canPublish = true;
    // Derive identity from auth — never trust client input for publishers
    resolvedIdentity = user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split("@")[0]
      || "主播";
  } else {
    // Viewer: use client-provided identity but sanitize
    if (!identity || typeof identity !== "string") {
      return Response.json({ error: "identity 为必填项" }, { status: 400 });
    }
    resolvedIdentity = identity.trim().slice(0, MAX_IDENTITY_LEN);
    if (!resolvedIdentity) {
      return Response.json({ error: "identity 不能为空" }, { status: 400 });
    }
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return Response.json({ error: "服务端未配置 LiveKit 凭据" }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: resolvedIdentity,
    ttl: "6h",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return Response.json({ token: jwt });
}
