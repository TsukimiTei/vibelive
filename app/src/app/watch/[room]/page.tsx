"use client";

import { useState, useCallback, useEffect } from "react";
import { use } from "react";
import {
  LiveKitRoom,
  VideoTrack,
  RoomAudioRenderer,
  useTracks,
  useRoomInfo,
  useParticipants,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import Link from "next/link";

function VideoArea() {
  const tracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const participants = useParticipants();
  const viewerCount = Math.max(0, participants.length - 1); // exclude self

  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare
  );

  if (!screenTrack) {
    return (
      <div className="relative pixel-border aspect-video bg-bg-primary overflow-hidden">
        <div className="scanline-overlay absolute inset-0" />
        <div className="absolute inset-0 ambient-gradient" />
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <span className="text-4xl mb-4">📡</span>
          <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-yellow glow-purple animate-pulse">
            等待主播开始屏幕共享...
          </span>
          <span className="text-xs text-text-secondary mt-2">
            已连接到房间，主播尚未推流
          </span>
        </div>

        {/* Viewer count */}
        <div className="absolute top-3 left-3 z-20">
          <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
            👁 {viewerCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pixel-border-live aspect-video bg-bg-primary overflow-hidden">
      <VideoTrack
        trackRef={screenTrack}
        className="w-full h-full object-contain"
      />
      <div className="scanline-overlay absolute inset-0 pointer-events-none" />

      {/* HUD overlays */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <span className="viewer-badge text-[9px]">
          <span className="live-dot inline-block w-2 h-2 rounded-full bg-white" />
          LIVE
        </span>
        <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
          👁 {viewerCount}
        </span>
      </div>
    </div>
  );
}

export default function WatchPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: roomName } = use(params);
  const [token, setToken] = useState<string | null>(null);
  const [identity, setIdentity] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const joinRoom = useCallback(async () => {
    const viewerName = identity.trim() || `观众${Math.floor(Math.random() * 9999)}`;

    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: decodeURIComponent(roomName),
          identity: viewerName,
          isPublisher: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "获取 token 失败");
      }

      const { token } = await res.json();
      setToken(token);
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失败");
    }
  }, [roomName, identity]);

  if (!joined) {
    return (
      <div className="ambient-gradient min-h-screen">
        <div className="mx-auto max-w-[600px] px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors"
            >
              ◁ 返回大厅
            </Link>
          </div>

          <div className="pixel-border bg-bg-card p-6 space-y-5">
            <div className="text-center space-y-2">
              <span className="font-[family-name:var(--font-pixel)] text-[12px] text-accent-cyan glow-cyan">
                加入直播间
              </span>
              <p className="text-sm text-text-secondary">
                房间: <span className="text-accent-green">{decodeURIComponent(roomName)}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">
                你的昵称（可选）
              </label>
              <input
                type="text"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="留空将随机分配"
                className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-cyan focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="pixel-border bg-accent-pink/10 border-accent-pink/30 px-3 py-2 text-xs text-accent-pink">
                ⚠ {error}
              </div>
            )}

            <button
              onClick={joinRoom}
              className="pixel-btn border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-bg-primary w-full text-[10px] py-3"
            >
              ▶ 进入直播间
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-gradient min-h-screen">
      <div className="mx-auto max-w-[1200px] px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors"
            >
              ◁ 返回大厅
            </Link>
            <span className="text-border-pixel">│</span>
            <span className="font-[family-name:var(--font-pixel)] text-[12px] text-text-primary">
              {decodeURIComponent(roomName)}
            </span>
          </div>
        </div>

        {/* LiveKit Room */}
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token!}
          connect={true}
          data-lk-theme="default"
        >
          <VideoArea />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
