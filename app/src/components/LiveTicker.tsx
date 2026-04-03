"use client";

const TICKER_ITEMS = [
  { icon: "🚀", text: "观众小李 对 NoteFlow 点了「想用」", color: "text-accent-green" },
  { icon: "✨", text: "CodeFan99 觉得 SnapMetrics 「有趣」", color: "text-accent-cyan" },
  { icon: "🔥", text: "新手观察者 「期待」QuickCut 上线", color: "text-accent-orange" },
  { icon: "🎮", text: "PixelCrafter 开始直播 NoteFlow", color: "text-accent-pink" },
  { icon: "🏆", text: "Code Wizard 的 QuickCut 获得 2664 个反应", color: "text-accent-yellow" },
  { icon: "⚡", text: "独立开发者小明 正在用 Bolt 开发 TaskForge", color: "text-accent-purple" },
  { icon: "🌟", text: "AI Artisan 的 LangBridge 进入语音翻译阶段", color: "text-accent-cyan" },
  { icon: "📦", text: "Dev Sensei 的 CodeQuest 已上线！", color: "text-accent-green" },
  { icon: "💻", text: "Neural Nomad 正在用 Copilot 开发 ReviewBot", color: "text-accent-pink" },
  { icon: "🎯", text: "MindMap AI 已发布 — 快去试用！", color: "text-accent-yellow" },
  { icon: "🔧", text: "ReviewBot 获得 999 个「想用」反应", color: "text-accent-green" },
  { icon: "🎲", text: "indie_hacker 的 PixelQuest 正在构建战斗系统", color: "text-accent-purple" },
];

export function LiveTicker() {
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="w-full overflow-hidden border-y border-border-pixel/50 bg-bg-secondary/50 py-1.5">
      <div className="ticker-scroll flex whitespace-nowrap gap-8">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs">
            <span>{item.icon}</span>
            <span className={item.color}>{item.text}</span>
            <span className="text-border-pixel mx-2">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
