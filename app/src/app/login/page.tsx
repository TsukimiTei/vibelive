"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("认证服务未配置");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("注册成功！请查收邮箱中的确认链接。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/";
      }
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="ambient-gradient min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/">
            <span className="font-[family-name:var(--font-pixel)] text-[16px] glow-green text-accent-green">
              VIBELIVE
            </span>
          </Link>
          <p className="text-sm text-text-secondary">
            {mode === "login" ? "登录你的账号" : "创建新账号"}
          </p>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-bg-card border-2 border-border-pixel px-4 py-3 text-sm text-text-primary hover:border-accent-cyan hover:text-accent-cyan transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google 登录
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border-pixel" />
          <span className="font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
            OR
          </span>
          <div className="flex-1 h-px bg-border-pixel" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="pixel-border bg-bg-card p-5 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-purple focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少 6 位"
              className="w-full bg-bg-primary border-2 border-border-pixel px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:border-accent-purple focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="bg-accent-pink/10 border border-accent-pink/30 px-3 py-2 text-xs text-accent-pink">
              ⚠ {error}
            </div>
          )}

          {message && (
            <div className="bg-accent-green/10 border border-accent-green/30 px-3 py-2 text-xs text-accent-green">
              ✓ {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pixel-btn border-accent-purple text-accent-purple hover:bg-accent-purple hover:text-white w-full text-[10px] py-3 disabled:opacity-50"
          >
            {loading
              ? "处理中..."
              : mode === "login"
                ? "▶ 邮箱登录"
                : "▶ 注册账号"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-xs text-text-secondary">
          {mode === "login" ? (
            <>
              还没有账号？{" "}
              <button
                onClick={() => { setMode("register"); setError(""); setMessage(""); }}
                className="text-accent-cyan hover:underline"
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？{" "}
              <button
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className="text-accent-cyan hover:underline"
              >
                登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
