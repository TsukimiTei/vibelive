import { AccessToken } from "livekit-server-sdk";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { room, identity, isPublisher } = await request.json();

  if (!room || !identity) {
    return Response.json(
      { error: "room 和 identity 为必填项" },
      { status: 400 }
    );
  }

  // Publisher tokens require authentication
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
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "服务端未配置 LiveKit 凭据" },
      { status: 500 }
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
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
