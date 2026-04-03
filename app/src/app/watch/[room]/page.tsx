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
import { Track, RoomEvent, DataPacket_Kind } from "livekit-client";
import Link from "next/link";

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

const REACTION_CONFIG: Record<ReactionKind, { label: string; icon: string }> = {
  want_to_use: { label: "想用", icon: "🚀" },
  interesting: { label: "有趣", icon: "✨" },
  looking_forward: { label: "期待", icon: "🔥" },
};

// ── Video Area ───────────────────────────────
function VideoArea() {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });
  const participants = useParticipants();
  const viewerCount = Math.max(0, participants.length - 1);

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  if (!screenTrack) {
    return (
      <div className="relative w-full h-full bg-bg-primary">
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
        <div className="absolute top-3 left-3 z-20">
          <span className="hud-panel px-2 py-1 font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary">
            👁 {viewerCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-bg-primary">
      <VideoTrack trackRef={screenTrack} className="w-full h-full object-contain" />
      <div className="scanline-overlay absolute inset-0 pointer-events-none" />
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

// ── Chat + Reactions Sidebar ─────────────────
function ChatSidebar({ viewerName }: { viewerName: string }) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [reactions, setReactions] = useState<Record<ReactionKind, number>>({
    want_to_use: 0,
    interesting: 0,
    looking_forward: 0,
  });
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(decoder.decode(payload));
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

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendChat = () => {
    const text = input.trim();
    if (!text) return;
    const payload = encoder.encode(JSON.stringify({ type: "chat", user: viewerName, text }));
    room.localParticipant.publishData(payload, { reliable: true });
    // Also add locally
    setMessages((prev) => [
      ...prev.slice(-200),
      { id: `${Date.now()}-${Math.random()}`, user: viewerName, text, time: Date.now() },
    ]);
    setInput("");
  };

  const sendReaction = (kind: ReactionKind) => {
    const payload = encoder.encode(JSON.stringify({ type: "reaction", kind, user: viewerName }));
    room.localParticipant.publishData(payload, { reliable: true });
    // Also add locally
    setReactions((prev) => ({ ...prev, [kind]: (prev[kind] || 0) + 1 }));
    const icon = REACTION_CONFIG[kind].icon;
    const id = `${Date.now()}-${Math.random()}`;
    setBursts((prev) => [...prev, { id, kind: icon, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 2000);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full pixel-border bg-bg-card">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-pixel/50 flex items-center gap-2">
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-cyan">◈</span>
        <span className="font-[family-name:var(--font-pixel)] text-[9px] text-text-secondary">实时聊天</span>
      </div>

      {/* Reaction floating bursts */}
      <div className="relative h-0">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute text-2xl animate-bounce pointer-events-none"
            style={{ left: `${b.x}%`, bottom: 0, animation: "float-up 2s ease-out forwards" }}
          >
            {b.kind}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-text-secondary/40 text-center py-8">
            还没有消息，说点什么吧
          </p>
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

      {/* Reactions */}
      <div className="px-3 py-2 border-t border-border-pixel/50 flex gap-1.5">
        {(Object.entries(REACTION_CONFIG) as [ReactionKind, { label: string; icon: string }][]).map(
          ([kind, { label, icon }]) => (
            <button
              key={kind}
              onClick={() => sendReaction(kind)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-border-pixel hover:border-accent-purple hover:bg-accent-purple/10 transition-colors text-xs"
            >
              <span>{icon}</span>
              <span className="text-text-secondary text-[10px]">{reactions[kind] || 0}</span>
            </button>
          )
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-border-pixel/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendChat();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="发送消息..."
            className="flex-1 bg-bg-primary border border-border-pixel px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/30 focus:border-accent-cyan focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan text-xs hover:bg-accent-cyan/30 transition-colors"
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}

const NICKNAME_KEY = "vibelive-nickname";

// ── Main Page ────────────────────────────────
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
  const [checkingNickname, setCheckingNickname] = useState(true);

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
      localStorage.setItem(NICKNAME_KEY, viewerName);
      setToken(data.token);
      setIdentity(viewerName);
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入失败");
      setCheckingNickname(false);
    }
  }, [roomName]);

  // Check for saved nickname on mount — auto-join if found
  useEffect(() => {
    const saved = localStorage.getItem(NICKNAME_KEY);
    if (saved) {
      setIdentity(saved);
      joinWithName(saved);
    } else {
      setCheckingNickname(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = useCallback(() => {
    joinWithName(identity);
  }, [identity, joinWithName]);

  // ── Loading while checking saved nickname ──
  if (checkingNickname && !joined) {
    return (
      <div className="ambient-gradient min-h-screen flex items-center justify-center">
        <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-cyan animate-pulse">
          正在加入直播间...
        </span>
      </div>
    );
  }

  // ── Join Screen (only shown when no saved nickname) ──
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
                你的昵称
              </label>
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

            <button
              onClick={handleJoin}
              className="pixel-btn border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-bg-primary w-full text-[10px] py-3"
            >
              ▶ 进入直播间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Theater Mode ──
  return (
    <div className="ambient-gradient h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 hud-panel shrink-0">
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

      {/* Main content: video left + chat right */}
      <LiveKitRoom serverUrl={livekitUrl} token={token!} connect={true}>
        <div className="flex flex-1 min-h-0">
          {/* Video - fills left */}
          <div className="flex-1 min-w-0 pixel-border-live m-2 mr-0 overflow-hidden">
            <VideoArea />
          </div>

          {/* Chat sidebar - fixed width */}
          <div className="w-[320px] shrink-0 m-2">
            <ChatSidebar viewerName={identity} />
          </div>
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>

      {/* Float-up animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-120px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
