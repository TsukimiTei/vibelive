"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";
import { MOCK_CHAT_MESSAGES } from "@/lib/mock-data";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      userId: "me",
      username: "你",
      avatarUrl: "",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full hud-panel overflow-hidden">
      {/* Header */}
      <div className="border-b border-border-pixel/50 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="font-[family-name:var(--font-pixel)] text-[9px] text-accent-green glow-green">
          ◈ 实时聊天
        </span>
        <span className="font-[family-name:var(--font-pixel)] text-[7px] text-text-secondary">
          {messages.length} 条
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className="group hover:bg-bg-surface/30 rounded px-1.5 py-1 -mx-1.5 transition-colors">
            <div className="flex items-baseline gap-1.5">
              <span className="font-[family-name:var(--font-pixel)] text-[6px] text-text-secondary/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {formatTime(msg.timestamp)}
              </span>
              <span
                className={`font-[family-name:var(--font-pixel)] text-[7px] shrink-0 ${
                  msg.userId === "me"
                    ? "text-accent-yellow"
                    : "text-accent-purple"
                }`}
              >
                {msg.username}
              </span>
              <p className="text-[12px] text-text-primary leading-relaxed break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border-pixel/50 p-2 shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="说点什么..."
            className="flex-1 bg-bg-primary/80 border border-border-pixel/50 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/30 outline-none focus:border-accent-purple/50 transition-colors"
          />
          <button
            onClick={sendMessage}
            className="pixel-btn border-accent-green text-accent-green hover:bg-accent-green hover:text-bg-primary text-[7px] px-3"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
