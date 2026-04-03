"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MOCK_STREAMS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface Notification {
  id: string;
  type: "follow" | "stream_live" | "favorite";
  actor_name: string;
  actor_avatar: string;
  target_id: string;
  target_title: string;
  read_at: string | null;
  created_at: string;
}

const NOTIF_TYPE_BASE = {
  follow: { icon: "♥", verbKey: "notify.follow" as const, color: "text-accent-pink" },
  stream_live: { icon: "▶", verbKey: "notify.live" as const, color: "text-accent-green" },
  favorite: { icon: "★", verbKey: "notify.favorite" as const, color: "text-accent-yellow" },
};

export function Navbar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('time.justNow');
    if (mins < 60) return t('time.minutesAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('time.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('time.daysAgo', { n: days });
    return new Date(ts).toLocaleDateString("zh-CN");
  };
  const mockLive = MOCK_STREAMS.filter((s) => s.status === "live").length;
  const mockViewers = MOCK_STREAMS.reduce((sum, s) => sum + s.viewers, 0);

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [realLiveCount, setRealLiveCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Poll unread notification count
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const fetchCount = () => {
      fetch("/api/notifications?unread=1")
        .then(r => r.json())
        .then(d => setUnreadCount(d.unread_count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch notifications when panel opens
  const openNotifPanel = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setMenuOpen(false);
    if (next) {
      fetch("/api/notifications")
        .then(r => r.json())
        .then(d => {
          setNotifications(d.notifications || []);
          setUnreadCount(d.unread_count || 0);
          setNotifLoaded(true);
        })
        .catch(() => {});
    }
  };

  const markAllRead = () => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  // Check for active stream from localStorage
  useEffect(() => {
    const check = () => {
      try {
        const saved = localStorage.getItem("vibelive_active_stream");
        setActiveRoom(saved ? JSON.parse(saved).roomName : null);
      } catch {
        setActiveRoom(null);
      }
    };
    check();
    // Re-check periodically (in case stream starts/stops in another tab)
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real live stream count
  useEffect(() => {
    const fetchCount = () => {
      fetch("/api/streams").then(r => r.json()).then(d => {
        setRealLiveCount(d.streams?.length || 0);
      }).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const liveCount = mockLive + realLiveCount;
  const totalViewers = mockViewers;

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;

  return (
    <nav className="sticky top-0 z-50 hud-panel">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-4">
        {/* Left: Logo + Stats */}
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 glitch-hover">
            <img src="/images/logo.png" alt="VibeLive" className="w-6 h-6 shrink-0" />
            <span className="font-[family-name:var(--font-pixel)] text-[13px] glow-green tracking-widest text-accent-green">
              VIBELIVE
            </span>
          </Link>

          {/* Live stats pill */}
          <div className="hidden sm:flex items-center gap-3 text-[8px] font-[family-name:var(--font-pixel)]">
            <span className="flex items-center gap-1.5 text-accent-pink">
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-accent-pink" />
              {liveCount} LIVE
            </span>
            <span className="text-border-pixel">│</span>
            <span className="text-text-secondary">
              {totalViewers} {t('nav.online')}
            </span>
          </div>
        </div>

        {/* Center: Nav links */}
        <div className="flex items-center gap-1">
          {[
            { href: "/", label: t('nav.home'), icon: "◈" },
            { href: "/explore", label: t('nav.explore'), icon: "◎" },
            { href: "/profile", label: t('nav.profile'), icon: "◇" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-1.5 text-xs transition-all relative ${
                pathname === link.href
                  ? "text-accent-cyan"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span className="font-[family-name:var(--font-pixel)] text-[8px] mr-1.5 opacity-50">
                {link.icon}
              </span>
              {link.label}
              {pathname === link.href && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-accent-cyan shadow-[0_0_8px_var(--glow-cyan)]" />
              )}
            </Link>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Notification bell + dropdown */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={openNotifPanel}
                className={`relative px-1.5 py-1 transition-colors ${notifOpen ? "text-accent-yellow" : "text-text-secondary hover:text-accent-yellow"}`}
                title={t('nav.notifications')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-accent-pink text-white font-[family-name:var(--font-pixel)] text-[6px] px-0.5 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 pixel-border bg-bg-card z-50 flex flex-col max-h-[420px]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border-pixel/50 shrink-0">
                    <span className="font-[family-name:var(--font-pixel)] text-[9px] text-text-primary">
                      {t('nav.notifications')}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-cyan hover:text-accent-green transition-colors"
                      >
                        {t('nav.markAllRead')}
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {!notifLoaded ? (
                      <p className="text-xs text-text-secondary/40 text-center py-6 animate-pulse">{t('nav.loading')}</p>
                    ) : notifications.length === 0 ? (
                      <p className="text-xs text-text-secondary/40 text-center py-6">{t('nav.noNotifications')}</p>
                    ) : (
                      notifications.slice(0, 15).map((n) => {
                        const cfg = NOTIF_TYPE_BASE[n.type];
                        const isUnread = !n.read_at;
                        return (
                          <div
                            key={n.id}
                            className={`px-3 py-2.5 flex items-start gap-2.5 border-b border-border-pixel/20 last:border-0 ${
                              isUnread ? "bg-accent-cyan/5" : ""
                            }`}
                          >
                            {/* Avatar */}
                            <div className="w-7 h-7 bg-bg-surface border border-border-pixel shrink-0 overflow-hidden mt-0.5">
                              {n.actor_avatar ? (
                                <img src={n.actor_avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="flex items-center justify-center w-full h-full font-[family-name:var(--font-pixel)] text-[8px] text-accent-purple">
                                  {n.actor_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-text-primary leading-relaxed">
                                <span className={`font-medium ${cfg.color}`}>{cfg.icon} {n.actor_name}</span>
                                {" "}<span className="text-text-secondary">{t(cfg.verbKey)}</span>
                                {n.target_title && n.type !== "follow" && (
                                  <Link
                                    href={`/watch/${n.target_id}`}
                                    className="text-accent-cyan hover:underline ml-0.5"
                                    onClick={() => setNotifOpen(false)}
                                  >
                                    {n.target_title}
                                  </Link>
                                )}
                              </p>
                              <span className="font-[family-name:var(--font-pixel)] text-[6px] text-text-secondary/40">
                                {timeAgo(n.created_at)}
                              </span>
                            </div>
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0 mt-2" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <Link
                      href="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center py-2 border-t border-border-pixel/50 font-[family-name:var(--font-pixel)] text-[8px] text-accent-cyan hover:text-accent-green transition-colors shrink-0"
                    >
                      {t('nav.viewAll')}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {activeRoom ? (
            <Link
              href="/go-live"
              className="pixel-btn border-accent-green text-bg-primary bg-accent-green hover:opacity-90 flex items-center gap-1.5"
            >
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-bg-primary" />
              {t('nav.myStream')}
            </Link>
          ) : (
            <Link
              href="/go-live"
              className="pixel-btn border-accent-green text-accent-green bg-transparent hover:bg-accent-green hover:text-bg-primary"
            >
              {t('nav.goLive')}
            </Link>
          )}

          {user ? (
            <div className="relative">
              <button
                onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
                className="flex items-center gap-2 px-2 py-1 border-2 border-border-pixel hover:border-accent-purple transition-colors"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-6 h-6 object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 bg-accent-purple/30 flex items-center justify-center font-[family-name:var(--font-pixel)] text-[8px] text-accent-purple">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-xs text-text-primary hidden sm:block max-w-[80px] truncate">
                  {displayName}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 pixel-border bg-bg-card py-1 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
                  >
                    {t('nav.profilePage')}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-accent-pink hover:bg-bg-surface transition-colors"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="pixel-btn border-accent-purple text-accent-purple bg-transparent hover:bg-accent-purple hover:text-white"
            >
              {t('nav.login')}
            </Link>
          )}

          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
