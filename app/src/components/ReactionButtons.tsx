"use client";

import { useState, useCallback } from "react";
import { ReactionType, Reactions, REACTION_CONFIG } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

interface ReactionButtonsProps {
  reactions: Reactions;
  size?: "sm" | "md";
}

export function ReactionButtons({
  reactions: initialReactions,
  size = "md",
}: ReactionButtonsProps) {
  const { t } = useI18n();
  const [reactions, setReactions] = useState(initialReactions);
  const [animating, setAnimating] = useState<ReactionType | null>(null);
  const [floats, setFloats] = useState<
    { id: number; type: ReactionType; x: number }[]
  >([]);

  const handleReaction = useCallback(
    (type: ReactionType) => {
      setReactions((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      setAnimating(type);
      setTimeout(() => setAnimating(null), 300);

      const id = Date.now();
      const x = Math.random() * 20 - 10;
      setFloats((prev) => [...prev, { id, type, x }]);
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.id !== id));
      }, 800);
    },
    []
  );

  const isSmall = size === "sm";

  return (
    <div className="flex items-center gap-2">
      {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((type) => {
        const config = REACTION_CONFIG[type];
        return (
          <button
            key={type}
            onClick={() => handleReaction(type)}
            className={`
              relative pixel-border flex items-center gap-1.5 bg-bg-surface
              hover:bg-bg-card transition-all cursor-pointer select-none
              ${isSmall ? "px-2 py-1" : "px-3 py-2"}
              ${animating === type ? "reaction-bounce" : ""}
            `}
          >
            <span className={isSmall ? "text-sm" : "text-lg"}>
              {config.icon}
            </span>
            <span
              className={`font-[family-name:var(--font-pixel)] text-text-secondary ${
                isSmall ? "text-[7px]" : "text-[9px]"
              }`}
            >
              {t(`reaction.${type}` as any)}
            </span>
            <span
              className={`font-[family-name:var(--font-pixel)] text-accent-yellow ${
                isSmall ? "text-[7px]" : "text-[9px]"
              }`}
            >
              {reactions[type]}
            </span>

            {/* Float-up numbers */}
            {floats
              .filter((f) => f.type === type)
              .map((f) => (
                <span
                  key={f.id}
                  className="absolute -top-2 left-1/2 float-up font-[family-name:var(--font-pixel)] text-[9px] text-accent-yellow pointer-events-none"
                  style={{ transform: `translateX(${f.x}px)` }}
                >
                  +1
                </span>
              ))}
          </button>
        );
      })}
    </div>
  );
}
