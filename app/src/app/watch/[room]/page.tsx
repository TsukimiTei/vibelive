"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { use } from "react";
import {
  LiveKitRoom,
  VideoTrack,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNickname } from "@/lib/useNickname";

// ── Types ────────────────────────────────────
interface ChatMsg {
  id: string;
  user: string;
  text: string;
  time: number;
}

interface ReactionBurst {
  id: string;
  kind: string;
  x: number;
}

type ReactionKind = "want_to_use" | "interesting" | "looking_forward";
type LayoutMode = "theater" | "default" | "fullscreen";

const REACTION_CONFIG: Record<ReactionKind, { label: string; icon: string }> = {
  want_to_use: { label: "想用", icon: "🚀" },
  interesting: { label: "有趣", icon: "✨" },
  looking_forward: { label: "期待", icon: "🔥" },
};

const CHAT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ── Player Controls ──────────────────────────
function PlayerControls({
  videoEl,
  layoutMode,
  onLayoutChange,
}: {
  videoEl: HTMLVideoElement | null;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio], {
    onlySubscribed: true,
  });

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  // Sync fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const togglePause = () => {
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play();
      setPaused(false);
    } else {
      videoEl.pause();
      setPaused(true);
    }
  };

  const toggleMute = () => {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    setMuted(videoEl.muted);
  };

  const changeVolume = (v: number) => {
    if (!videoEl) return;
    videoEl.volume = v / 100;
    videoEl.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  };

  const setQuality = (height: number | "auto") => {
    const pub = screenTrack?.publication as { setVideoQuality?: (q: number) => void } | undefined;
    if (!pub?.setVideoQuality) return;
    if (height === "auto") {
      pub.setVideoQuality(2); // HIGH
    } else if (height <= 480) {
      pub.setVideoQuality(0); // LOW
    } else if (height <= 720) {
      pub.setVideoQuality(1); // MEDIUM
    } else {
      pub.setVideoQuality(2); // HIGH
    }
    setShowQuality(false);
  };

  const toggleFullscreen = () => {
    const target = containerRef.current?.closest("[data-player-root]") as HTMLElement;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      target.requestFullscreen();
    }
  };

  const toggleTheater = () => {
    if (isFullscreen) {
      document.exitFullscreen();
      return;
    }
    onLayoutChange(layoutMode === "theater" ? "default" : "theater");
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    >
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button onClick={togglePause} className="text-white hover:text-accent-cyan transition-colors" title={paused ? "播放" : "暂停"}>
          {paused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          )}
        </button>

        {/* Volume */}
        <div className="relative flex items-center" onMouseEnter={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
          <button onClick={toggleMute} className="text-white hover:text-accent-cyan transition-colors" title={muted ? "取消静音" : "静音"}>
            {muted || volume === 0 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : volume < 50 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            )}
          </button>
          {showVolume && (
            <input
              type="range"
              min="0"
              max="100"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="ml-2 w-20 h-1 accent-accent-cyan cursor-pointer"
            />
          )}
        </div>

        <div className="flex-1" />

        {/* Quality */}
        <div className="relative">
          <button onClick={() => setShowQuality(!showQuality)} className="text-white hover:text-accent-cyan transition-colors text-xs font-[family-name:var(--font-pixel)] text-[8px]" title="清晰度">
            HD
          </button>
          {showQuality && (
            <div className="absolute bottom-full right-0 mb-2 pixel-border bg-bg-card py-1 min-w-[100px] z-50">
              {[
                { label: "自动", value: "auto" as const },
                { label: "1080p", value: 1080 },
                { label: "720p", value: 720 },
                { label: "480p", value: 480 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setQuality(opt.value)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theater mode (desktop only) */}
        <button onClick={toggleTheater} className="hidden lg:block text-white hover:text-accent-cyan transition-colors" title={layoutMode === "theater" ? "默认模式" : "剧院模式"}>
          {layoutMode === "theater" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v3H5z"/></svg>
          )}
        </button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} className="text-white hover:text-accent-cyan transition-colors" title={isFullscreen ? "退出全屏" : "全屏"}>
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Video Area ───────────────────────────────
function VideoArea({
  layoutMode,
  onLayoutChange,
}: {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
}) {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });
  const participants = useParticipants();
  const viewerCount = Math.max(0, participants.length - 1);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  // Capture the video element from VideoTrack via callback ref
  const videoContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const vid = node.querySelector("video");
      if (vid) setVideoEl(vid);
    }
  }, [screenTrack]);

  if (!screenTrack) {
    return (
      <div className="relative w-full h-full bg-bg-primary group">
        <div className="scanline-overlay absolute inset-0" />
        <div className="absolute inset-0 ambient-gradient" />
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <span className="text-4xl mb-4">📡</span>
          <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-yellow glow-purple animate-pulse">
            等待主播开始屏幕共享...
          </span>
        </div>
        <div className="absolute top-3 left-3 z-20">
          <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
            👁 {viewerCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-bg-primary group" ref={videoContainerRef}>
      <VideoTrack trackRef={screenTrack} className="w-full h-full object-contain" />

      {/* HUD */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="viewer-badge text-[9px]">
          <span className="live-dot inline-block w-2 h-2 rounded-full bg-white" />
          LIVE
        </span>
        <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
          👁 {viewerCount}
        </span>
      </div>

      {/* Player controls */}
      <PlayerControls videoEl={videoEl} layoutMode={layoutMode} onLayoutChange={onLayoutChange} />
    </div>
  );
}

// ── Sidebar (Chat / Info / Users tabs) ───────
const STAGES = ["构思中", "设计中", "编码中", "调试中", "测试中", "发布中", "已完成"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function Sidebar({ viewerName, roomName }: { viewerName: string; roomName: string }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [tab, setTab] = useState<"chat" | "info" | "users">("chat");
  const decodedRoom = decodeURIComponent(roomName);
  const chatStorageKey = `vibelive-chat-${decodedRoom}`;
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (!raw) return [];
      const saved: ChatMsg[] = JSON.parse(raw);
      const cutoff = Date.now() - CHAT_TTL_MS;
      return saved.filter((m) => m.time > cutoff).slice(-200);
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [reactions, setReactions] = useState<Record<ReactionKind, number>>({
    want_to_use: 0, interesting: 0, looking_forward: 0,
  });
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [streamInfo, setStreamInfo] = useState<{
    project_name?: string; description?: string; stage?: string; streamer_name?: string; started_at?: string; user_id?: string;
  } | null>(null);
  const [isStreamer, setIsStreamer] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const router = useRouter();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounced save for streamer editing
  const saveField = useCallback(
    (fields: Record<string, string>) => {
      if (!isStreamer) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        await fetch("/api/streams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_name: decodedRoom, ...fields }),
        }).catch(() => {});
        setSaving(false);
      }, 600);
    },
    [roomName, isStreamer]
  );

  const updateField = (key: string, value: string) => {
    setStreamInfo((prev) => (prev ? { ...prev, [key]: value } : prev));
    saveField({ [key]: value });
  };

  // Fetch stream info + check if current user is the streamer
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch("/api/streams");
        if (res.ok) {
          const { streams } = await res.json();
          const match = streams.find((s: { room_name: string }) => s.room_name === decodedRoom);
          if (match) {
            setStreamInfo(match);
            // Check ownership via Supabase
            if (match.user_id) {
              const supabase = createClient();
              if (supabase) {
                const { data } = await supabase.auth.getUser();
                const isOwner = data.user?.id === match.user_id;
                setIsStreamer(isOwner);

                // Check follow/favorite status
                if (data.user && !isOwner) {
                  fetch(`/api/follows?following_id=${match.user_id}`)
                    .then(r => r.json()).then(d => setIsFollowing(d.isFollowing)).catch(() => {});
                  fetch(`/api/favorites?room_name=${encodeURIComponent(decodedRoom)}`)
                    .then(r => r.json()).then(d => setIsFavorited(d.isFavorited)).catch(() => {});
                }
              }
            }
          }
        }
      } catch {}
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 15000);
    return () => clearInterval(interval);
  }, [roomName]);

  // Data channel messages
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(textDecoder.decode(payload));
        if (msg.type === "chat") {
          setMessages((prev) => [
            ...prev.slice(-200),
            { id: `${Date.now()}-${Math.random()}`, user: msg.user, text: msg.text, time: Date.now() },
          ]);
        } else if (msg.type === "reaction") {
          const kind = msg.kind as ReactionKind;
          setReactions((prev) => ({ ...prev, [kind]: (prev[kind] || 0) + 1 }));
          const icon = REACTION_CONFIG[kind]?.icon || "❤️";
          const id = `${Date.now()}-${Math.random()}`;
          setBursts((prev) => [...prev, { id, kind: icon, x: 20 + Math.random() * 60 }]);
          setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 2000);
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // Persist messages to localStorage (keep only last 10 min)
  useEffect(() => {
    const cutoff = Date.now() - CHAT_TTL_MS;
    const fresh = messages.filter((m) => m.time > cutoff);
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(fresh.slice(-200)));
    } catch {}
  }, [messages, chatStorageKey]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendChat = () => {
    const text = input.trim();
    if (!text) return;
    const payload = textEncoder.encode(JSON.stringify({ type: "chat", user: viewerName, text }));
    room.localParticipant.publishData(payload, { reliable: true });
    setMessages((prev) => [
      ...prev.slice(-200),
      { id: `${Date.now()}-${Math.random()}`, user: viewerName, text, time: Date.now() },
    ]);
    setInput("");
  };

  const sendReaction = (kind: ReactionKind) => {
    const payload = textEncoder.encode(JSON.stringify({ type: "reaction", kind, user: viewerName }));
    room.localParticipant.publishData(payload, { reliable: true });
    setReactions((prev) => ({ ...prev, [kind]: (prev[kind] || 0) + 1 }));
    const icon = REACTION_CONFIG[kind].icon;
    const id = `${Date.now()}-${Math.random()}`;
    setBursts((prev) => [...prev, { id, kind: icon, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 2000);
  };

  const endStream = async () => {
    setEnding(true);
    try {
      const res = await fetch("/api/streams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: decodedRoom }),
      });
      if (!res.ok) throw new Error();
      // Clean up go-live localStorage so it doesn't try to reconnect
      localStorage.removeItem("vibelive_active_stream");
      // Server-side DELETE also removes the LiveKit room, disconnecting all participants
      router.push("/");
    } catch {
      setEnding(false);
      setShowEndConfirm(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const tabs = [
    { key: "chat" as const, label: "聊天", icon: "💬" },
    { key: "info" as const, label: "项目", icon: "◈" },
    { key: "users" as const, label: `在线 ${participants.length}`, icon: "◉" },
  ];

  return (
    <div className="flex flex-col h-full pixel-border bg-bg-card">
      {/* Tabs */}
      <div className="flex border-b border-border-pixel/50 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-2 text-[10px] font-[family-name:var(--font-pixel)] transition-colors ${
              tab === t.key
                ? "text-accent-cyan border-b-2 border-accent-cyan"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── Chat Tab ── */}
      {tab === "chat" && (
        <>
          <div className="relative h-0">
            {bursts.map((b) => (
              <span key={b.id} className="absolute text-2xl pointer-events-none"
                style={{ left: `${b.x}%`, bottom: 0, animation: "float-up 2s ease-out forwards" }}>{b.kind}</span>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-text-secondary/40 text-center py-8">还没有消息，说点什么吧</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="text-xs">
                <span className="text-text-secondary/40 mr-1.5 text-[10px]">{formatTime(msg.time)}</span>
                <span className="text-accent-cyan font-medium">{msg.user}</span>
                <span className="text-text-secondary mx-1">:</span>
                <span className="text-text-primary">{msg.text}</span>
              </div>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-border-pixel/50 flex gap-1.5 shrink-0">
            {(Object.entries(REACTION_CONFIG) as [ReactionKind, { label: string; icon: string }][]).map(
              ([kind, { icon }]) => (
                <button key={kind} onClick={() => sendReaction(kind)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-border-pixel hover:border-accent-purple hover:bg-accent-purple/10 transition-colors text-xs">
                  <span>{icon}</span>
                  <span className="text-text-secondary text-[10px]">{reactions[kind] || 0}</span>
                </button>
              )
            )}
          </div>

          <div className="px-3 py-2 border-t border-border-pixel/50 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="发送消息..."
                className="flex-1 bg-bg-primary border border-border-pixel px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/30 focus:border-accent-cyan focus:outline-none" />
              <button type="submit"
                className="px-3 py-1.5 bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan text-xs hover:bg-accent-cyan/30 transition-colors">
                发送
              </button>
            </form>
          </div>
        </>
      )}

      {/* ── Info Tab ── */}
      {tab === "info" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {streamInfo ? (
            <>
              {/* Streamer management panel */}
              {isStreamer && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-green bg-accent-green/10 border border-accent-green/30 px-2 py-0.5">
                      主播模式 · 可编辑
                    </span>
                    {saving && (
                      <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-yellow animate-pulse ml-auto">保存中...</span>
                    )}
                  </div>
                  {/* Stream controls */}
                  <div className="flex gap-2">
                    <Link
                      href="/go-live"
                      className="flex-1 text-center py-1.5 text-[10px] font-[family-name:var(--font-pixel)] border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
                    >
                      开播控制台
                    </Link>
                    {!showEndConfirm ? (
                      <button
                        onClick={() => setShowEndConfirm(true)}
                        className="flex-1 py-1.5 text-[10px] font-[family-name:var(--font-pixel)] border border-accent-pink/40 text-accent-pink hover:bg-accent-pink/10 transition-colors"
                      >
                        下播
                      </button>
                    ) : (
                      <div className="flex-1 flex gap-1">
                        <button
                          onClick={endStream}
                          disabled={ending}
                          className="flex-1 py-1.5 text-[10px] font-[family-name:var(--font-pixel)] bg-accent-pink/20 border border-accent-pink text-accent-pink hover:bg-accent-pink hover:text-white transition-colors disabled:opacity-50"
                        >
                          {ending ? "结束中..." : "确认下播"}
                        </button>
                        <button
                          onClick={() => setShowEndConfirm(false)}
                          className="px-2 py-1.5 text-[10px] font-[family-name:var(--font-pixel)] border border-border-pixel text-text-secondary hover:text-text-primary transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Project name */}
              <div>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">项目名称</span>
                {isStreamer ? (
                  <input
                    type="text"
                    value={streamInfo.project_name || ""}
                    onChange={(e) => updateField("project_name", e.target.value)}
                    placeholder="你正在做什么项目？"
                    className="w-full mt-1 bg-bg-primary border border-border-pixel px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/30 focus:border-accent-purple focus:outline-none transition-colors"
                  />
                ) : (
                  <p className="text-sm text-text-primary mt-1">
                    {streamInfo.project_name || <span className="text-text-secondary/40">未设置</span>}
                  </p>
                )}
              </div>

              {/* Stage */}
              <div>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">当前阶段</span>
                {isStreamer ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateField("stage", s)}
                        className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
                          streamInfo.stage === s
                            ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                            : "border-border-pixel text-text-secondary hover:border-text-secondary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1">
                    <span className="px-2 py-0.5 text-xs border border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10">
                      {streamInfo.stage || "构思中"}
                    </span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">项目描述</span>
                {isStreamer ? (
                  <textarea
                    value={streamInfo.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="简单介绍一下你的项目..."
                    rows={4}
                    className="w-full mt-1 bg-bg-primary border border-border-pixel px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/30 focus:border-accent-purple focus:outline-none transition-colors resize-none"
                  />
                ) : (
                  <p className="text-xs text-text-primary/80 mt-1 leading-relaxed whitespace-pre-wrap">
                    {streamInfo.description || <span className="text-text-secondary/40">主播还没写描述</span>}
                  </p>
                )}
              </div>

              <div className="border-t border-border-pixel/30 pt-3">
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">主播</span>
                <p className="text-sm text-accent-purple mt-1">{streamInfo.streamer_name}</p>
              </div>
              {streamInfo.started_at && (
                <div>
                  <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">开播时间</span>
                  <p className="text-xs text-text-secondary mt-1">
                    {new Date(streamInfo.started_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              )}

              {/* Follow + Favorite buttons */}
              {!isStreamer && streamInfo.user_id && (
                <div className="border-t border-border-pixel/30 pt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      const method = isFollowing ? "DELETE" : "POST";
                      const res = await fetch("/api/follows", {
                        method,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ following_id: streamInfo.user_id }),
                      });
                      if (res.ok) setIsFollowing(!isFollowing);
                    }}
                    className={`flex-1 py-1.5 text-[10px] font-[family-name:var(--font-pixel)] border transition-colors ${
                      isFollowing
                        ? "border-text-secondary text-text-secondary bg-bg-surface"
                        : "border-accent-pink text-accent-pink hover:bg-accent-pink hover:text-white"
                    }`}
                  >
                    {isFollowing ? "✓ 已关注" : "+ 关注"}
                  </button>
                  <button
                    onClick={async () => {
                      const method = isFavorited ? "DELETE" : "POST";
                      const res = await fetch("/api/favorites", {
                        method,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          room_name: decodedRoom,
                          stream_title: streamInfo.project_name || streamInfo.streamer_name,
                          streamer_name: streamInfo.streamer_name,
                        }),
                      });
                      if (res.ok) setIsFavorited(!isFavorited);
                    }}
                    className={`flex-1 py-1.5 text-[10px] font-[family-name:var(--font-pixel)] border transition-colors ${
                      isFavorited
                        ? "border-accent-yellow text-bg-primary bg-accent-yellow"
                        : "border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-bg-primary"
                    }`}
                  >
                    {isFavorited ? "★ 已收藏" : "☆ 收藏"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-text-secondary/40 text-center py-8">加载中...</p>
          )}
        </div>
      )}

      {/* ── Users Tab ── */}
      {tab === "users" && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
          {participants.map((p) => {
            const isPublisher = p.permissions?.canPublish;
            return (
              <div key={p.identity} className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-surface/50 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isPublisher ? "bg-accent-green" : "bg-accent-cyan"}`} />
                <span className="text-xs text-text-primary truncate flex-1">{p.identity}</span>
                {isPublisher && (
                  <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-green">主播</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Constants ────────────────────────────────
// ── Watch Layout (handles desktop/mobile) ────
function WatchLayout({
  layoutMode, onLayoutChange, mobilePanel, onMobilePanelChange, identity, roomName,
}: {
  layoutMode: LayoutMode;
  onLayoutChange: (m: LayoutMode) => void;
  mobilePanel: "video" | "chat";
  onMobilePanelChange: (p: "video" | "chat") => void;
  identity: string;
  roomName: string;
}) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 1024);
    check(); // sync on mount
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (desktop) {
    if (layoutMode === "theater") {
      return (
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 pixel-border-live m-2 mr-0 overflow-hidden">
            <VideoArea layoutMode={layoutMode} onLayoutChange={onLayoutChange} />
          </div>
          <div className="w-[320px] shrink-0 m-2 flex flex-col">
            <Sidebar viewerName={identity} roomName={roomName} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-4 py-3 space-y-3">
          <div className="pixel-border-live aspect-video overflow-hidden">
            <VideoArea layoutMode={layoutMode} onLayoutChange={onLayoutChange} />
          </div>
          <div className="h-[400px]">
            <Sidebar viewerName={identity} roomName={roomName} />
          </div>
        </div>
      </div>
    );
  }

  // Mobile
  if (mobilePanel === "video") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="pixel-border-live m-1 aspect-video overflow-hidden shrink-0">
          <VideoArea layoutMode="default" onLayoutChange={onLayoutChange} />
        </div>
        <div className="px-2 py-1 flex items-center gap-2">
          <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary truncate flex-1">
            {decodeURIComponent(roomName)}
          </span>
          <button
            onClick={() => onMobilePanelChange("chat")}
            className="px-2 py-1 text-[9px] border border-accent-cyan text-accent-cyan font-[family-name:var(--font-pixel)]"
          >
            💬 聊天
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 m-1">
      <Sidebar viewerName={identity} roomName={roomName} />
    </div>
  );
}

// ── Main Page ────────────────────────────────
export default function WatchPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: roomName } = use(params);
  const { nickname: profileName } = useNickname();
  const [token, setToken] = useState<string | null>(null);
  const [identity, setIdentity] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("theater");
  const [mobilePanel, setMobilePanel] = useState<"video" | "chat">("video");

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const joinWithName = useCallback(async (name: string) => {
    const viewerName = name.trim() || `观众${Math.floor(Math.random() * 9999)}`;
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
      const data = await res.json();
      setToken(data.token);
      setIdentity(viewerName);
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失败");
      setLoading(false);
    }
  }, [roomName]);

  // Auto-join when profile nickname is resolved
  useEffect(() => {
    if (profileName === null) return; // still loading
    if (joined) return;
    if (profileName) {
      // Logged in — auto-join with profile name
      joinWithName(profileName);
    } else {
      // Not logged in — show nickname input
      setLoading(false);
    }
  }, [profileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = useCallback(() => {
    joinWithName(identity);
  }, [identity, joinWithName]);

  // Loading
  if (loading && !joined) {
    return (
      <div className="ambient-gradient min-h-screen flex items-center justify-center">
        <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-cyan animate-pulse">
          正在加入直播间...
        </span>
      </div>
    );
  }

  // Join screen
  if (!joined) {
    return (
      <div className="ambient-gradient min-h-screen">
        <div className="mx-auto max-w-[600px] px-4 py-12">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors">
              ◁ 返回大厅
            </Link>
          </div>
          <div className="pixel-border bg-bg-card p-6 space-y-5">
            <div className="text-center space-y-2">
              <span className="font-[family-name:var(--font-pixel)] text-[12px] text-accent-cyan glow-cyan">加入直播间</span>
              <p className="text-sm text-text-secondary">
                房间: <span className="text-accent-green">{decodeURIComponent(roomName)}</span>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">你的昵称</label>
              <input
                type="text"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="输入你的昵称"
                className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-cyan focus:outline-none transition-colors"
              />
            </div>
            {error && (
              <div className="pixel-border bg-accent-pink/10 border-accent-pink/30 px-3 py-2 text-xs text-accent-pink">
                ⚠ {error}
              </div>
            )}
            <button onClick={handleJoin} className="pixel-btn border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-bg-primary w-full text-[10px] py-3">
              ▶ 进入直播间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Watching
  const isTheater = layoutMode === "theater";

  return (
    <div className="ambient-gradient h-screen flex flex-col" data-player-root>
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 hud-panel shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors shrink-0">
            ◁ 返回
          </Link>
          <span className="text-border-pixel hidden sm:inline">│</span>
          <span className="font-[family-name:var(--font-pixel)] text-[10px] sm:text-[12px] text-text-primary truncate">
            {decodeURIComponent(roomName)}
          </span>
        </div>

        {/* Mobile panel toggle */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            onClick={() => setMobilePanel("video")}
            className={`px-2 py-1 text-[9px] font-[family-name:var(--font-pixel)] border transition-colors ${
              mobilePanel === "video" ? "border-accent-cyan text-accent-cyan" : "border-border-pixel text-text-secondary"
            }`}
          >
            画面
          </button>
          <button
            onClick={() => setMobilePanel("chat")}
            className={`px-2 py-1 text-[9px] font-[family-name:var(--font-pixel)] border transition-colors ${
              mobilePanel === "chat" ? "border-accent-cyan text-accent-cyan" : "border-border-pixel text-text-secondary"
            }`}
          >
            聊天
          </button>
        </div>
      </div>

      <LiveKitRoom serverUrl={livekitUrl} token={token!} connect={true} className="flex flex-col flex-1 min-h-0">
        <WatchLayout
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          mobilePanel={mobilePanel}
          onMobilePanelChange={setMobilePanel}
          identity={identity}
          roomName={roomName}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>

      <style jsx global>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-120px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
