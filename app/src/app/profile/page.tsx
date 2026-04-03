"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MOCK_STREAMS } from "@/lib/mock-data";
import { Stream, CATEGORY_LABELS, PLATFORM_LABELS } from "@/lib/types";
import { ToolBadge } from "@/components/ToolBadge";

type Tab = "following" | "favorites" | "achievements";

const MOCK_USER = {
  displayName: "VibeCoder",
  username: "vibecoder",
  avatarUrl: "/images/avatars/avatar_default.png",
  joinedAt: "2026-03-01",
  followingIds: ["s1", "s3", "s5", "s6"],
  favoriteProjectIds: ["p2", "p3", "p4", "p7", "p11"],
  level: 12,
  xp: 740,
  xpNext: 1000,
  totalWatchTime: 2340, // minutes
  reactionsGiven: 89,
};

const ACHIEVEMENTS = [
  { icon: "👁", name: "初见", desc: "观看第一场直播", unlocked: true },
  { icon: "🚀", name: "尝鲜者", desc: "对 10 个项目点了「想用」", unlocked: true },
  { icon: "🔥", name: "忠实观众", desc: "累计观看 10 小时", unlocked: true },
  { icon: "⭐", name: "收藏家", desc: "收藏 5 个项目", unlocked: false },
  { icon: "🏆", name: "全勤", desc: "连续 7 天观看直播", unlocked: false },
  { icon: "💎", name: "钻石眼", desc: "见证 10 个项目上线", unlocked: false },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("following");

  const followingStreamers = MOCK_STREAMS.filter((s) =>
    MOCK_USER.followingIds.includes(s.streamer.id)
  );
  const favoriteProjects = MOCK_STREAMS.filter((s) =>
    MOCK_USER.favoriteProjectIds.includes(s.project.id)
  );

  const watchHours = Math.floor(MOCK_USER.totalWatchTime / 60);

  return (
    <div className="ambient-gradient min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ── Character Card ──────────────────── */}
        <div className="pixel-border-glow bg-bg-card p-5 mb-6 relative overflow-hidden">
          <div className="scanline-overlay absolute inset-0 opacity-30" />
          <div className="relative z-10">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 bg-bg-surface border-2 border-accent-purple overflow-hidden shadow-[0_0_20px_var(--glow-purple)]">
                  <Image src={MOCK_USER.avatarUrl} alt={MOCK_USER.displayName} width={80} height={80} className="object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 font-[family-name:var(--font-pixel)] text-[7px] bg-accent-yellow text-bg-primary px-1.5 py-0.5 border border-bg-primary">
                  Lv.{MOCK_USER.level}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="font-[family-name:var(--font-pixel)] text-sm text-text-primary">
                  {MOCK_USER.displayName}
                </h1>
                <p className="text-sm text-text-secondary mt-1">
                  @{MOCK_USER.username}
                </p>

                {/* XP Bar */}
                <div className="mt-3 max-w-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
                      EXP
                    </span>
                    <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-yellow">
                      {MOCK_USER.xp} / {MOCK_USER.xpNext}
                    </span>
                  </div>
                  <div className="stat-bar">
                    <div
                      className="stat-bar-fill bg-accent-yellow"
                      style={{
                        width: `${(MOCK_USER.xp / MOCK_USER.xpNext) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {[
                  { label: "关注", value: MOCK_USER.followingIds.length, color: "text-accent-pink" },
                  { label: "收藏", value: MOCK_USER.favoriteProjectIds.length, color: "text-accent-yellow" },
                  { label: "观看时长", value: `${watchHours}h`, color: "text-accent-cyan" },
                  { label: "反应", value: MOCK_USER.reactionsGiven, color: "text-accent-green" },
                ].map((stat) => (
                  <div key={stat.label} className="pixel-border bg-bg-primary/50 p-2 text-center min-w-[80px]">
                    <p className={`font-[family-name:var(--font-pixel)] text-sm ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="font-[family-name:var(--font-pixel)] text-[6px] text-text-secondary mt-1">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ──────────────────── */}
        <div className="flex items-center gap-1 mb-5">
          {[
            { key: "following" as Tab, label: "关注主播", icon: "♥", count: followingStreamers.length },
            { key: "favorites" as Tab, label: "收藏项目", icon: "★", count: favoriteProjects.length },
            { key: "achievements" as Tab, label: "成就徽章", icon: "◆", count: ACHIEVEMENTS.filter((a) => a.unlocked).length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs transition-all border-b-2 ${
                activeTab === tab.key
                  ? "text-accent-cyan border-accent-cyan"
                  : "text-text-secondary border-transparent hover:text-text-primary hover:border-border-pixel"
              }`}
            >
              <span className="font-[family-name:var(--font-pixel)] text-[8px] mr-1.5 opacity-50">
                {tab.icon}
              </span>
              {tab.label}
              <span className="ml-2 font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────── */}

        {activeTab === "following" && (
          <div className="space-y-2">
            {followingStreamers.length === 0 ? (
              <EmptyState text="还没有关注任何主播" />
            ) : (
              followingStreamers.map((stream) => (
                <StreamerRow key={stream.streamer.id} stream={stream} />
              ))
            )}
          </div>
        )}

        {activeTab === "favorites" && (
          <div className="space-y-2">
            {favoriteProjects.length === 0 ? (
              <EmptyState text="还没有收藏任何项目" />
            ) : (
              favoriteProjects.map((stream) => (
                <ProjectRow key={stream.project.id} stream={stream} />
              ))
            )}
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((ach) => (
              <div
                key={ach.name}
                className={`pixel-border p-4 text-center transition-all ${
                  ach.unlocked
                    ? "bg-bg-card"
                    : "bg-bg-primary/50 opacity-40"
                }`}
              >
                <span className="text-3xl block mb-2">
                  {ach.unlocked ? ach.icon : "🔒"}
                </span>
                <h4 className="font-[family-name:var(--font-pixel)] text-[9px] text-text-primary">
                  {ach.name}
                </h4>
                <p className="text-[11px] text-text-secondary mt-1">
                  {ach.desc}
                </p>
                {ach.unlocked && (
                  <span className="inline-block mt-2 font-[family-name:var(--font-pixel)] text-[6px] text-accent-green">
                    ✓ 已解锁
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamerRow({ stream }: { stream: Stream }) {
  const { streamer, status, codingTool, project } = stream;
  const isLive = status === "live";

  return (
    <Link href={`/stream/${stream.id}`} className="block group">
      <div className={`card-glow p-3 flex items-center gap-3 ${
        isLive ? "pixel-border-live bg-bg-card" : "pixel-border bg-bg-card"
      }`}>
        <div className="w-10 h-10 bg-bg-surface border border-border-pixel shrink-0 relative overflow-hidden">
          {streamer.avatarUrl ? (
            <Image src={streamer.avatarUrl} alt={streamer.displayName} width={40} height={40} className="object-cover" />
          ) : (
            <span className="flex items-center justify-center w-full h-full font-[family-name:var(--font-pixel)] text-[10px] text-accent-purple">
              {streamer.displayName.charAt(0)}
            </span>
          )}
          {isLive && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-pink rounded-full live-dot border border-bg-card" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-text-primary group-hover:text-accent-cyan transition-colors">
              {streamer.displayName}
            </span>
            {isLive && (
              <span className="font-[family-name:var(--font-pixel)] text-[7px] text-accent-pink">
                LIVE
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-secondary truncate">
            {isLive ? `正在开发 ${project.name}` : streamer.bio}
          </p>
        </div>

        <ToolBadge tool={codingTool} />
      </div>
    </Link>
  );
}

function ProjectRow({ stream }: { stream: Stream }) {
  const { project, streamer, reactions } = stream;

  return (
    <Link href={`/stream/${stream.id}`} className="block group">
      <div className="card-glow pixel-border bg-bg-card p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-bg-surface border border-border-pixel shrink-0 overflow-hidden relative">
          {project.thumbnailUrl ? (
            <Image src={project.thumbnailUrl} alt={project.name} fill className="object-cover" sizes="40px" />
          ) : (
            <span className="flex items-center justify-center w-full h-full font-[family-name:var(--font-pixel)] text-[10px] text-accent-cyan">
              {project.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-pixel)] text-[10px] text-text-primary group-hover:text-accent-cyan transition-colors">
              {project.name}
            </span>
            {project.productUrl && (
              <span className="font-[family-name:var(--font-pixel)] text-[6px] text-accent-green border border-accent-green/30 px-1">
                已上线
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-secondary truncate">
            by {streamer.displayName} · {project.description}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2 font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
          <span>🚀{reactions.want_to_use}</span>
          <span>✨{reactions.interesting}</span>
          <span>🔥{reactions.looking_forward}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="pixel-border bg-bg-card p-12 text-center">
      <span className="text-3xl block mb-3 opacity-40">📭</span>
      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-text-secondary">
        {text}
      </p>
      <Link
        href="/"
        className="inline-block mt-3 pixel-btn border-accent-purple text-accent-purple hover:bg-accent-purple hover:text-white text-[8px]"
      >
        去大厅看看
      </Link>
    </div>
  );
}
