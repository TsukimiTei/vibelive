import Link from "next/link";

interface LiveStream {
  id: string;
  room_name: string;
  streamer_name: string;
  title: string;
  coding_tool: string;
  status: string;
  viewers_count: number;
  started_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
    username: string;
    bio: string;
    followers_count: number;
  };
}

export function LiveStreamCard({ stream }: { stream: LiveStream }) {
  const profile = stream.profiles;
  const displayName = profile?.display_name || stream.streamer_name;
  const avatarUrl = profile?.avatar_url;
  const startedAt = new Date(stream.started_at);
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  const elapsedStr = elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;

  return (
    <Link href={`/watch/${stream.room_name}`} className="block group">
      <div className="card-glow overflow-hidden bg-bg-card relative pixel-border-live transition-all hover:scale-[1.02]">
        {/* Video placeholder area */}
        <div className="aspect-video bg-bg-primary relative overflow-hidden">
          <div className="scanline-overlay absolute inset-0" />
          <div className="absolute inset-0 ambient-gradient" />

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-[family-name:var(--font-pixel)] text-5xl text-accent-green/20">
              {stream.room_name.slice(0, 3).toUpperCase()}
            </span>
            <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-green/50 mt-2">
              LIVE · 屏幕共享中
            </span>
          </div>

          {/* LIVE badge */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
            <span className="viewer-badge text-[8px]">
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-white" />
              LIVE
            </span>
            <span className="hud-panel px-1.5 py-0.5 font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
              👁 {stream.viewers_count}
            </span>
          </div>

          {/* Real stream badge */}
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-accent-green/20 border border-accent-green/40 px-1.5 py-0.5 font-[family-name:var(--font-pixel)] text-[7px] text-accent-green">
              REAL
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 object-cover border border-border-pixel shrink-0" />
            ) : (
              <span className="w-8 h-8 bg-accent-purple/30 flex items-center justify-center font-[family-name:var(--font-pixel)] text-[10px] text-accent-purple border border-border-pixel shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm text-text-primary truncate group-hover:text-accent-green transition-colors">
                {stream.title || stream.room_name}
              </h3>
              <p className="text-xs text-text-secondary truncate">
                {displayName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[8px] font-[family-name:var(--font-pixel)] text-text-secondary">
            <span className="text-accent-yellow">⏱ {elapsedStr}</span>
            <span className="text-border-pixel">│</span>
            <span>{stream.room_name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
