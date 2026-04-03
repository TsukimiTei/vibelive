"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ScreenSharePresets,
} from "livekit-client";
import Link from "next/link";

type BroadcastState = "idle" | "connecting" | "live" | "error";
type QualityLevel = "720p" | "1080p" | "original";

const QUALITY_MAP = {
  "720p": ScreenSharePresets.h720fps30,
  "1080p": ScreenSharePresets.h1080fps30,
  "original": ScreenSharePresets.original,
};

const STORAGE_KEY = "vibelive_active_stream";

interface ActiveStream {
  roomName: string;
  identity: string;
  startedAt: number;
  quality?: QualityLevel;
}

export default function GoLivePage() {
  const [roomName, setRoomName] = useState("");
  const [identity, setIdentity] = useState("");
  const [quality, setQuality] = useState<QualityLevel>("1080p");
  const [state, setState] = useState<BroadcastState>("idle");
  const [error, setError] = useState("");
  const [viewers, setViewers] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Callback ref: attaches screen share track as soon as the video element mounts
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    if (!el || !roomRef.current) return;
    const screenPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (screenPub?.track) {
      screenPub.track.attach(el);
    }
  }, [state]); // re-run when state changes so it fires on mount

  // Check for active stream on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const active: ActiveStream = JSON.parse(saved);
        setRoomName(active.roomName);
        setIdentity(active.identity);
        startedAtRef.current = active.startedAt;
        reconnect(active);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setupRoomEvents = (room: Room) => {
    room.on(RoomEvent.ParticipantConnected, () => {
      setViewers(room.remoteParticipants.size);
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      setViewers(room.remoteParticipants.size);
    });
    room.on(RoomEvent.Disconnected, () => {
      setState("idle");
      if (timerRef.current) clearInterval(timerRef.current);
    });
  };

  const startTimer = (startedAt: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
  };

  const connectAndShare = async (roomName: string, identity: string, q: QualityLevel = "1080p"): Promise<Room> => {
    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName, identity, isPublisher: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "获取 token 失败");
    }

    const { token } = await res.json();
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) throw new Error("未配置 NEXT_PUBLIC_LIVEKIT_URL");

    const preset = QUALITY_MAP[q];
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    setupRoomEvents(room);

    // Listen for track unpublished (user clicks browser's "Stop sharing")
    room.localParticipant.on("localTrackUnpublished", (pub) => {
      if (pub.source === Track.Source.ScreenShare) {
        stopBroadcast();
      }
    });

    await room.connect(livekitUrl, token);
    roomRef.current = room;

    await room.localParticipant.setScreenShareEnabled(true, {
      audio: true,
      contentHint: "detail",
      resolution: preset.resolution,
    });

    return room;
  };

  const reconnect = async (active: ActiveStream) => {
    setState("connecting");
    setError("");

    try {
      setQuality(active.quality || "1080p");
      const room = await connectAndShare(active.roomName, active.identity, active.quality || "1080p");
      setState("live");
      setViewers(room.remoteParticipants.size);
      startTimer(active.startedAt);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setState("idle");
      setError("之前的直播已断开，请重新开播");
    }
  };

  const startBroadcast = useCallback(async () => {
    if (!roomName.trim() || !identity.trim()) {
      setError("请填写房间名和主播名");
      return;
    }

    setState("connecting");
    setError("");

    try {
      const room = await connectAndShare(roomName.trim(), identity.trim(), quality);

      // Register stream in database
      fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: roomName.trim(),
          title: roomName.trim(),
          coding_tool: "other",
        }),
      }).catch(() => {});

      // Save to localStorage for reconnect
      const now = Date.now();
      startedAtRef.current = now;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ roomName: roomName.trim(), identity: identity.trim(), startedAt: now, quality })
      );

      // Set state to live — useEffect will attach the video track
      setState("live");
      setViewers(room.remoteParticipants.size);
      startTimer(now);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "连接失败");
    }
  }, [roomName, identity]);

  const stopBroadcast = useCallback(async () => {
    if (roomName) {
      fetch("/api/streams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: roomName.trim() }),
      }).catch(() => {});
    }

    localStorage.removeItem(STORAGE_KEY);

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState("idle");
    setElapsed(0);
    setViewers(0);
  }, [roomName]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="ambient-gradient min-h-screen">
      <div className="mx-auto max-w-[1000px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors"
          >
            ◁ 返回大厅
          </Link>
          <span className="text-border-pixel">│</span>
          <h1 className="font-[family-name:var(--font-pixel)] text-[14px] text-accent-green glow-green">
            开播控制台
          </h1>
        </div>

        {/* Setup Form */}
        {(state === "idle" || state === "error") && (
          <div className="pixel-border bg-bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-purple">◈</span>
              <span className="font-[family-name:var(--font-pixel)] text-[9px] text-text-secondary">
                直播设置
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  房间名（观众将通过此名称加入）
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="例如: my-coding-stream"
                  className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-purple focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  主播名
                </label>
                <input
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="你的显示名称"
                  className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-purple focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  画质
                </label>
                <div className="flex gap-2">
                  {(["720p", "1080p", "original"] as QualityLevel[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={`flex-1 py-2 text-xs font-[family-name:var(--font-pixel)] text-[8px] border-2 transition-colors ${
                        quality === q
                          ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                          : "border-border-pixel text-text-secondary hover:border-text-secondary"
                      }`}
                    >
                      {q === "original" ? "原画" : q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="pixel-border bg-accent-pink/10 border-accent-pink/30 px-3 py-2 text-xs text-accent-pink">
                ⚠ {error}
              </div>
            )}

            <button
              onClick={startBroadcast}
              className="pixel-btn border-accent-green text-accent-green hover:bg-accent-green hover:text-bg-primary w-full text-[10px] py-3"
            >
              ▶ 开始直播（屏幕共享）
            </button>

            <p className="text-[10px] text-text-secondary/60 text-center">
              点击后浏览器会弹出屏幕选择窗口，选择要共享的屏幕或窗口
            </p>
          </div>
        )}

        {/* Connecting */}
        {state === "connecting" && (
          <div className="pixel-border bg-bg-card p-12 flex flex-col items-center gap-4">
            <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-yellow glow-purple animate-pulse">
              正在连接 LiveKit...
            </span>
            <span className="text-xs text-text-secondary">
              请在弹出的窗口中选择要共享的屏幕
            </span>
          </div>
        )}

        {/* Live */}
        {state === "live" && (
          <div className="space-y-4">
            <div className="relative pixel-border-live aspect-video bg-bg-primary overflow-hidden">
              <video
                ref={videoCallbackRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="scanline-overlay absolute inset-0 pointer-events-none" />

              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <span className="viewer-badge text-[9px]">
                  <span className="live-dot inline-block w-2 h-2 rounded-full bg-white" />
                  LIVE
                </span>
                <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
                  👁 {viewers}
                </span>
              </div>

              <div className="absolute top-3 right-3 z-20">
                <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-accent-yellow">
                  ⏱ {formatTime(elapsed)}
                </span>
              </div>
            </div>

            <div className="hud-panel p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-[family-name:var(--font-pixel)] text-[9px] text-accent-green">
                  ● 直播中
                </div>
                <div className="text-xs text-text-secondary">
                  房间: <span className="text-text-primary">{roomName}</span>
                  {" · "}
                  观看链接:{" "}
                  <Link href={`/watch/${roomName}`} className="text-accent-cyan hover:underline">
                    /watch/{roomName}
                  </Link>
                </div>
              </div>

              <button
                onClick={stopBroadcast}
                className="pixel-btn border-accent-pink text-accent-pink hover:bg-accent-pink hover:text-white text-[10px]"
              >
                ■ 结束直播
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
