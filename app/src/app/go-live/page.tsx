"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ScreenSharePresets,
  VideoPreset,
} from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNickname } from "@/lib/useNickname";
import { createClient } from "@/lib/supabase/client";

type BroadcastState = "idle" | "connecting" | "live" | "error";
type QualityLevel = "720p" | "1080p" | "original" | "ultra";

const QUALITY_MAP: Record<QualityLevel, { preset: VideoPreset; label: string }> = {
  "720p":     { preset: ScreenSharePresets.h720fps30,  label: "720p" },
  "1080p":    { preset: ScreenSharePresets.h1080fps30, label: "1080p" },
  "original": { preset: ScreenSharePresets.original,   label: "原画" },
  "ultra":    { preset: new VideoPreset(0, 0, 15_000_000, 30, "high"), label: "超清" },
};

const STORAGE_KEY = "vibelive_active_stream";

interface ActiveStream {
  roomName: string;
  identity: string;
  startedAt: number;
  quality?: QualityLevel;
}

export default function GoLivePage() {
  const router = useRouter();
  const { nickname } = useNickname();
  const [authChecked, setAuthChecked] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [codingTool, setCodingTool] = useState("cursor");
  const [quality, setQuality] = useState<QualityLevel>("ultra");
  const [state, setState] = useState<BroadcastState>("idle");
  const [error, setError] = useState("");
  const [viewers, setViewers] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Project info
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectStage, setProjectStage] = useState("构思中");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomRef = useRef<Room | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  // Callback ref: attaches screen share track when the video element mounts.
  // Depends on `state` so React re-calls the ref when transitioning to "live".
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    if (!el || !roomRef.current) return;
    const screenPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (screenPub?.track) {
      screenPub.track.attach(el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Check for active stream on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const active: ActiveStream = JSON.parse(saved);
        setRoomName(active.roomName);
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

    const { preset } = QUALITY_MAP[q];
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
    }, {
      screenShareEncoding: preset.encoding,
    });

    return room;
  };

  const reconnect = async (active: ActiveStream) => {
    setState("connecting");
    setError("");

    try {
      setQuality(active.quality || "1080p");
      const room = await connectAndShare(active.roomName, nickname || "主播", active.quality || "1080p");
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
    if (!roomName.trim()) {
      setError("请填写房间名");
      return;
    }

    setState("connecting");
    setError("");

    try {
      const name = nickname || "主播";
      const room = await connectAndShare(roomName.trim(), name, quality);

      // Register stream in database
      fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: roomName.trim(),
          title: roomName.trim(),
          coding_tool: codingTool,
          thumbnail_url: thumbnailUrl,
        }),
      }).catch(() => {});

      // Save to localStorage for reconnect
      const now = Date.now();
      startedAtRef.current = now;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ roomName: roomName.trim(), identity: name, startedAt: now, quality })
      );

      // Set state to live — useEffect will attach the video track
      setState("live");
      setViewers(room.remoteParticipants.size);
      startTimer(now);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "连接失败");
    }
  }, [roomName, nickname, quality, codingTool]);

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
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Disconnect LiveKit room on unmount to prevent resource leaks
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const uploadThumbnail = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("未配置");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `thumbnails/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("thumbnails").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("thumbnails").getPublicUrl(path);
      setThumbnailUrl(publicUrl);
      // If already live, save immediately
      if (state === "live" && roomName) {
        fetch("/api/streams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_name: roomName.trim(), thumbnail_url: publicUrl }),
        }).catch(() => {});
      }
    } catch {
      setError("封面图上传失败");
    } finally {
      setUploading(false);
    }
  };

  const STAGES = ["构思中", "设计中", "编码中", "调试中", "测试中", "发布中", "已完成"];

  // Auto-save project info with debounce
  const saveProjectInfo = useCallback(
    (fields: { project_name?: string; description?: string; stage?: string }) => {
      if (!roomName) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        await fetch("/api/streams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_name: roomName.trim(), ...fields }),
        }).catch(() => {});
        setSaving(false);
      }, 600);
    },
    [roomName]
  );

  const updateProjectName = (v: string) => {
    setProjectName(v);
    saveProjectInfo({ project_name: v });
  };
  const updateProjectDesc = (v: string) => {
    setProjectDesc(v);
    saveProjectInfo({ description: v });
  };
  const updateProjectStage = (v: string) => {
    setProjectStage(v);
    saveProjectInfo({ stage: v });
  };

  if (!authChecked) {
    return (
      <div className="ambient-gradient min-h-screen flex items-center justify-center">
        <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-cyan animate-pulse">
          验证登录状态...
        </span>
      </div>
    );
  }

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

              {nickname && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-text-secondary">主播:</span>
                  <span className="text-xs text-accent-cyan">{nickname}</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  AI 工具
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "cursor", label: "Cursor" },
                    { key: "copilot", label: "Copilot" },
                    { key: "claude-code", label: "Claude Code" },
                    { key: "windsurf", label: "Windsurf" },
                    { key: "v0", label: "v0" },
                    { key: "bolt", label: "Bolt" },
                    { key: "replit", label: "Replit" },
                    { key: "other", label: "其他" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setCodingTool(t.key)}
                      className={`px-2.5 py-1.5 text-[10px] border-2 transition-colors ${
                        codingTool === t.key
                          ? "border-accent-purple text-accent-purple bg-accent-purple/10"
                          : "border-border-pixel text-text-secondary hover:border-text-secondary"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  画质
                </label>
                <div className="flex gap-2">
                  {(Object.entries(QUALITY_MAP) as [QualityLevel, { preset: VideoPreset; label: string }][]).map(([q, { label }]) => (
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
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  封面图（可选）
                </label>
                <div className="flex items-center gap-3">
                  {thumbnailUrl ? (
                    <div className="relative w-24 h-14 border border-border-pixel overflow-hidden shrink-0 bg-bg-primary">
                      <img src={thumbnailUrl} alt="封面" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setThumbnailUrl("")}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white text-[8px] flex items-center justify-center hover:bg-accent-pink transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border-2 border-dashed border-border-pixel hover:border-accent-purple text-text-secondary hover:text-accent-purple transition-colors text-xs">
                      <span>{uploading ? "上传中..." : "📷 选择图片"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadThumbnail(file);
                        }}
                      />
                    </label>
                  )}
                  <span className="text-[10px] text-text-secondary/50">
                    展示在大厅直播列表中
                  </span>
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

            {/* Project Info Editor */}
            <div className="pixel-border bg-bg-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-purple">◈</span>
                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-text-secondary">
                  项目信息
                </span>
                {saving && (
                  <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-yellow ml-auto animate-pulse">
                    保存中...
                  </span>
                )}
                {!saving && projectName && (
                  <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-green/50 ml-auto">
                    ✓ 已保存
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">项目名称</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => updateProjectName(e.target.value)}
                    placeholder="你正在做什么项目？"
                    className="w-full bg-bg-primary border border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/30 focus:border-accent-purple focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1">当前阶段</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateProjectStage(s)}
                        className={`px-2 py-1 text-[10px] border transition-colors ${
                          projectStage === s
                            ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                            : "border-border-pixel text-text-secondary hover:border-text-secondary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">项目描述</label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => updateProjectDesc(e.target.value)}
                  placeholder="简单介绍一下你的项目、用了什么技术栈、想解决什么问题..."
                  rows={3}
                  className="w-full bg-bg-primary border border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/30 focus:border-accent-purple focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Thumbnail during live */}
              <div>
                <label className="block text-xs text-text-secondary mb-1">封面图</label>
                <div className="flex items-center gap-3">
                  {thumbnailUrl ? (
                    <div className="relative w-24 h-14 border border-border-pixel overflow-hidden shrink-0 bg-bg-primary">
                      <img src={thumbnailUrl} alt="封面" className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          setThumbnailUrl("");
                          fetch("/api/streams", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ room_name: roomName.trim(), thumbnail_url: "" }),
                          }).catch(() => {});
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white text-[8px] flex items-center justify-center hover:bg-accent-pink transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-dashed border-border-pixel hover:border-accent-purple text-text-secondary hover:text-accent-purple transition-colors text-xs">
                      <span>{uploading ? "上传中..." : "📷 上传封面"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadThumbnail(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
