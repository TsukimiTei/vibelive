"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────
export type ReactionKind = "want_to_use" | "interesting" | "looking_forward" | "mind_blown" | "big_brain";

export interface ReactionConfig {
  label: string;
  icon: string;
  color: string;      // tailwind color name (e.g. "accent-cyan")
  glowVar: string;    // CSS glow variable value
}

export const REACTION_CONFIG: Record<ReactionKind, ReactionConfig> = {
  want_to_use:     { label: "想用", icon: "🚀", color: "accent-cyan",   glowVar: "var(--glow-cyan)" },
  interesting:     { label: "有趣", icon: "✨", color: "accent-yellow", glowVar: "var(--glow-yellow, rgba(255,215,0,0.5))" },
  looking_forward: { label: "期待", icon: "🔥", color: "accent-pink",   glowVar: "var(--glow-pink, rgba(255,100,130,0.5))" },
  mind_blown:      { label: "炸裂", icon: "🤯", color: "accent-pink",   glowVar: "var(--glow-pink, rgba(255,100,130,0.5))" },
  big_brain:       { label: "高手", icon: "🧠", color: "accent-purple", glowVar: "var(--glow-purple)" },
};

export interface OverlayBurst {
  id: string;
  icon: string;
  x: number;       // 5-95%
  tier: 0 | 1 | 2 | 3;
  glowVar: string;
  color: string;
}

export type ComboTier = 0 | 1 | 2 | 3;

interface ComboEntry {
  timestamps: number[];
  tier: ComboTier;
}

export interface ComboState {
  [kind: string]: ComboEntry;
}

const COMBO_WINDOW_MS = 3000;
const TIER_THRESHOLDS = [0, 5, 15, 30]; // tier 0: <5, tier 1: 5-14, tier 2: 15-29, tier 3: 30+
const MAX_BURSTS = 30;

function getTier(count: number): ComboTier {
  if (count >= TIER_THRESHOLDS[3]) return 3;
  if (count >= TIER_THRESHOLDS[2]) return 2;
  if (count >= TIER_THRESHOLDS[1]) return 1;
  return 0;
}

// ── Hook: useReactionSystem ────────────────────
export function useReactionSystem() {
  const [bursts, setBursts] = useState<OverlayBurst[]>([]);
  const [combo, setCombo] = useState<ComboState>({});
  const [showBanner, setShowBanner] = useState<{ icon: string; count: number; color: string } | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the highest active combo tier across all kinds
  const maxTier: ComboTier = Object.values(combo).reduce(
    (max, entry) => Math.max(max, entry.tier) as ComboTier, 0 as ComboTier
  );

  // Register a reaction event (called for both local sends and remote receives)
  const addReaction = (kind: ReactionKind) => {
    const cfg = REACTION_CONFIG[kind];
    if (!cfg) return;

    const now = Date.now();

    // Update combo state
    setCombo(prev => {
      const entry = prev[kind] || { timestamps: [], tier: 0 };
      const cutoff = now - COMBO_WINDOW_MS;
      const timestamps = [...entry.timestamps.filter(t => t > cutoff), now];
      const tier = getTier(timestamps.length);

      // Trigger tier 3 banner if just crossed threshold
      if (tier === 3 && entry.tier < 3) {
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        setShowBanner({ icon: cfg.icon, count: timestamps.length, color: cfg.color });
        setScreenFlash(true);
        setTimeout(() => setScreenFlash(false), 400);
        bannerTimer.current = setTimeout(() => setShowBanner(null), 2000);
      }

      return { ...prev, [kind]: { timestamps, tier } };
    });

    // Add burst(s) based on current tier
    setCombo(prev => {
      const entry = prev[kind] || { timestamps: [], tier: 0 };
      const tier = entry.tier;
      const burstCount = tier >= 2 ? 3 : tier >= 1 ? 2 : 1;

      const newBursts: OverlayBurst[] = Array.from({ length: burstCount }, (_, i) => ({
        id: `${now}-${Math.random()}-${i}`,
        icon: cfg.icon,
        x: 5 + Math.random() * 90,
        tier,
        glowVar: cfg.glowVar,
        color: cfg.color,
      }));

      setBursts(prev => [...prev.slice(-(MAX_BURSTS - burstCount)), ...newBursts]);

      // Cleanup after animation
      const duration = tier >= 3 ? 2800 : tier >= 2 ? 2500 : 2200;
      setTimeout(() => {
        setBursts(prev => prev.filter(b => !newBursts.some(nb => nb.id === b.id)));
      }, duration);

      return prev;
    });
  };

  // Decay combo tiers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - COMBO_WINDOW_MS;
      setCombo(prev => {
        let changed = false;
        const next = { ...prev };
        for (const kind of Object.keys(next)) {
          const entry = next[kind];
          const timestamps = entry.timestamps.filter(t => t > cutoff);
          const tier = getTier(timestamps.length);
          if (timestamps.length !== entry.timestamps.length || tier !== entry.tier) {
            next[kind] = { timestamps, tier };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { bursts, combo, maxTier, showBanner, screenFlash, addReaction };
}

// ── Overlay Component ──────────────────────────
export function ReactionOverlay({
  bursts,
  showBanner,
  screenFlash,
}: {
  bursts: OverlayBurst[];
  showBanner: { icon: string; count: number; color: string } | null;
  screenFlash: boolean;
}) {
  return (
    <>
      {/* Screen flash effect */}
      {screenFlash && (
        <div className="absolute inset-0 z-25 pointer-events-none screen-flash" />
      )}

      {/* Reaction particles */}
      <div className="reaction-overlay">
        {bursts.map((b) => (
          <span
            key={b.id}
            className={`reaction-particle tier-${b.tier}`}
            style={{
              left: `${b.x}%`,
              "--reaction-glow": b.glowVar,
            } as React.CSSProperties}
          >
            {b.icon}
            {/* Pixel burst particles for tier 1+ */}
            {b.tier >= 1 && (
              <span
                className="reaction-burst"
                style={{ color: `var(--${b.color})`, position: "absolute", top: "50%", left: "50%" }}
              />
            )}
          </span>
        ))}

        {/* Combo banner (tier 3) */}
        {showBanner && (
          <div className="combo-banner">
            <div className="pixel-border bg-bg-primary/90 px-6 py-3 text-center" style={{ boxShadow: `0 0 30px var(--${showBanner.color}), 0 0 60px var(--${showBanner.color})` }}>
              <div className="font-[family-name:var(--font-pixel)] text-[20px] mb-1">
                {showBanner.icon} COMBO x{showBanner.count} {showBanner.icon}
              </div>
              <div className="font-[family-name:var(--font-pixel)] text-[9px] text-accent-cyan tracking-widest">
                M E L T D O W N
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
