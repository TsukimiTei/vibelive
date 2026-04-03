"use client";

import { useI18n, type Locale } from "@/lib/i18n/context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 border-2 border-border-pixel hover:border-accent-cyan transition-colors font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary hover:text-accent-cyan"
      title={locale === "zh" ? "Switch to English" : "切换为中文"}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
