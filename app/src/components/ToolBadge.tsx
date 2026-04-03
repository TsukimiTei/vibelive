import { CodingTool, TOOL_LABELS } from "@/lib/types";

const TOOL_COLORS: Record<CodingTool, string> = {
  cursor: "border-accent-purple text-accent-purple",
  copilot: "border-accent-cyan text-accent-cyan",
  windsurf: "border-accent-green text-accent-green",
  "claude-code": "border-accent-orange text-accent-orange",
  v0: "border-accent-pink text-accent-pink",
  bolt: "border-accent-yellow text-accent-yellow",
  replit: "border-accent-cyan text-accent-cyan",
  other: "border-text-secondary text-text-secondary",
};

const TOOL_ICONS: Record<CodingTool, string> = {
  cursor: "⌘",
  copilot: "🤖",
  windsurf: "🏄",
  "claude-code": "🧠",
  v0: "▲",
  bolt: "⚡",
  replit: "💻",
  other: "🔧",
};

interface ToolBadgeProps {
  tool: CodingTool;
}

export function ToolBadge({ tool }: ToolBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 font-[family-name:var(--font-pixel)] text-[8px] ${TOOL_COLORS[tool]}`}
    >
      <span>{TOOL_ICONS[tool]}</span>
      {TOOL_LABELS[tool]}
    </span>
  );
}
