"use client";

import { useState } from "react";
import {
  ProductCategory,
  PlatformType,
  CATEGORY_LABELS,
  PLATFORM_LABELS,
} from "@/lib/types";

interface FilterBarProps {
  onFilterChange: (filters: {
    category: ProductCategory | null;
    platform: PlatformType | null;
    sortBy: "viewers" | "reactions" | "recent";
  }) => void;
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [activeCategory, setActiveCategory] =
    useState<ProductCategory | null>(null);
  const [activePlatform, setActivePlatform] =
    useState<PlatformType | null>(null);
  const [sortBy, setSortBy] = useState<"viewers" | "reactions" | "recent">(
    "viewers"
  );

  const handleCategory = (cat: ProductCategory | null) => {
    setActiveCategory(cat);
    onFilterChange({ category: cat, platform: activePlatform, sortBy });
  };

  const handlePlatform = (plat: PlatformType | null) => {
    setActivePlatform(plat);
    onFilterChange({ category: activeCategory, platform: plat, sortBy });
  };

  const handleSort = (s: "viewers" | "reactions" | "recent") => {
    setSortBy(s);
    onFilterChange({ category: activeCategory, platform: activePlatform, sortBy: s });
  };

  const categories = Object.entries(CATEGORY_LABELS) as [
    ProductCategory,
    string,
  ][];
  const platforms = Object.entries(PLATFORM_LABELS) as [
    PlatformType,
    string,
  ][];

  return (
    <div className="space-y-3">
      {/* Categories */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary mr-1">
          分类
        </span>
        <button
          onClick={() => handleCategory(null)}
          className={`pixel-tag cursor-pointer transition-colors ${
            activeCategory === null ? "filter-chip-active" : "hover:text-text-primary"
          }`}
        >
          全部
        </button>
        {categories.map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleCategory(key)}
            className={`pixel-tag cursor-pointer transition-colors ${
              activeCategory === key
                ? "filter-chip-active"
                : "hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Platforms */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary mr-1">
          平台
        </span>
        <button
          onClick={() => handlePlatform(null)}
          className={`pixel-tag cursor-pointer transition-colors ${
            activePlatform === null ? "filter-chip-active" : "hover:text-text-primary"
          }`}
        >
          全部
        </button>
        {platforms.map(([key, label]) => (
          <button
            key={key}
            onClick={() => handlePlatform(key)}
            className={`pixel-tag cursor-pointer transition-colors ${
              activePlatform === key
                ? "filter-chip-active"
                : "hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-text-secondary mr-1">
          排序
        </span>
        {[
          { key: "viewers" as const, label: "观看最多" },
          { key: "reactions" as const, label: "最热反应" },
          { key: "recent" as const, label: "最新开始" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSort(opt.key)}
            className={`pixel-tag cursor-pointer transition-colors ${
              sortBy === opt.key
                ? "filter-chip-active"
                : "hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
