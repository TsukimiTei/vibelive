"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MOCK_STREAMS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const liveCount = MOCK_STREAMS.filter((s) => s.status === "live").length;
  const totalViewers = MOCK_STREAMS.reduce((sum, s) => sum + s.viewers, 0);

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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
              {totalViewers} 在线
            </span>
          </div>
        </div>

        {/* Center: Nav links */}
        <div className="flex items-center gap-1">
          {[
            { href: "/", label: "大厅", icon: "◈" },
            { href: "/explore", label: "探索", icon: "◎" },
            { href: "/profile", label: "我的", icon: "◇" },
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
          {/* Notification bell */}
          {user && (
            <Link
              href="/notifications"
              className="relative px-1.5 py-1 text-text-secondary hover:text-accent-yellow transition-colors"
              title="通知"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-accent-pink text-white font-[family-name:var(--font-pixel)] text-[6px] px-0.5 leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {activeRoom ? (
            <Link
              href="/go-live"
              className="pixel-btn border-accent-green text-bg-primary bg-accent-green hover:opacity-90 flex items-center gap-1.5"
            >
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-bg-primary" />
              我的直播
            </Link>
          ) : (
            <Link
              href="/go-live"
              className="pixel-btn border-accent-green text-accent-green bg-transparent hover:bg-accent-green hover:text-bg-primary"
            >
              开播
            </Link>
          )}

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
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
                    个人主页
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-accent-pink hover:bg-bg-surface transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="pixel-btn border-accent-purple text-accent-purple bg-transparent hover:bg-accent-purple hover:text-white"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
