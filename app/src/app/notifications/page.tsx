"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: "follow" | "stream_live" | "favorite";
  actor_id: string;
  actor_name: string;
  actor_avatar: string;
  target_id: string;
  target_title: string;
  read_at: string | null;
  created_at: string;
}

const TYPE_CONFIG = {
  follow: { icon: "♥", verb: "关注了你", color: "text-accent-pink" },
  stream_live: { icon: "▶", verb: "开始直播", color: "text-accent-green" },
  favorite: { icon: "★", verb: "收藏了你的直播", color: "text-accent-yellow" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { router.replace("/login"); return; }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }

      fetch("/api/notifications")
        .then(r => r.json())
        .then(d => {
          setNotifications(d.notifications || []);
          setUnreadCount(d.unread_count || 0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [router]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return new Date(ts).toLocaleDateString("zh-CN");
  };

  if (loading) {
    return (
      <div className="ambient-gradient min-h-screen flex items-center justify-center">
        <span className="font-[family-name:var(--font-pixel)] text-[11px] text-accent-cyan animate-pulse">
          加载中...
        </span>
      </div>
    );
  }

  return (
    <div className="ambient-gradient min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan transition-colors"
            >
              ◁ 返回
            </Link>
            <span className="text-border-pixel">│</span>
            <h1 className="font-[family-name:var(--font-pixel)] text-[14px] text-text-primary">
              通知中心
            </h1>
            {unreadCount > 0 && (
              <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-pink bg-accent-pink/10 border border-accent-pink/30 px-2 py-0.5">
                {unreadCount} 未读
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-cyan hover:text-accent-green transition-colors"
            >
              全部已读
            </button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="pixel-border bg-bg-card p-12 text-center">
            <span className="text-3xl block mb-3 opacity-40">🔔</span>
            <p className="font-[family-name:var(--font-pixel)] text-[9px] text-text-secondary">
              暂无通知
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type];
              const isUnread = !n.read_at;

              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && markRead(n.id)}
                  className={`pixel-border p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    isUnread
                      ? "bg-accent-cyan/5 border-accent-cyan/20 hover:bg-accent-cyan/10"
                      : "bg-bg-card hover:bg-bg-surface/50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 bg-bg-surface border border-border-pixel shrink-0 overflow-hidden">
                    {n.actor_avatar ? (
                      <img src={n.actor_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full font-[family-name:var(--font-pixel)] text-[10px] text-accent-purple">
                        {n.actor_name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary">
                      <span className={`font-medium ${config.color}`}>
                        {config.icon} {n.actor_name}
                      </span>
                      {" "}
                      <span className="text-text-secondary">{config.verb}</span>
                      {n.target_title && n.type !== "follow" && (
                        <>
                          {" "}
                          <Link
                            href={`/watch/${n.target_id}`}
                            className="text-accent-cyan hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {n.target_title}
                          </Link>
                        </>
                      )}
                    </p>
                    <span className="font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary/50 mt-0.5 block">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-accent-cyan shrink-0 shadow-[0_0_6px_var(--glow-cyan)]" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
