"use client";

import { ProjectStage } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

interface ProgressBarProps {
  stages: ProjectStage[];
  compact?: boolean;
}

export function ProgressBar({ stages, compact = false }: ProgressBarProps) {
  const { t } = useI18n();
  const completedCount = stages.filter((s) => s.completed).length;
  const progress = (completedCount / stages.length) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="pixel-border flex-1 h-4 bg-bg-primary p-[2px]">
          <div
            className="pixel-progress-fill h-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-accent-cyan whitespace-nowrap">
          {completedCount}/{stages.length}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-pixel)] text-[10px] text-text-secondary">
          {t('stream.progress')}
        </span>
        <span className="font-[family-name:var(--font-pixel)] text-[10px] text-accent-cyan">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="pixel-border h-6 bg-bg-primary p-[3px]">
        <div
          className="pixel-progress-fill h-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className={`font-[family-name:var(--font-pixel)] text-[10px] ${
                stage.completed ? "text-accent-green" : "text-text-secondary"
              }`}
            >
              {stage.completed ? "■" : "□"}
            </span>
            <span
              className={
                stage.completed
                  ? "text-text-primary"
                  : "text-text-secondary"
              }
            >
              {stage.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
