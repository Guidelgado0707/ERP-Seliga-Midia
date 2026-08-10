"use client";

import { useState } from "react";

type Item = { label: string; value: number };

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Barras horizontais, hue único (magnitude, não identidade) — ver skill de dataviz.
export default function CategoryBarChart({ items }: { items: Item[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((i) => i.value), 1);
  const total = sorted.reduce((acc, i) => acc + i.value, 0);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted px-5 py-6">Sem custos categorizados neste período ainda.</p>;
  }

  return (
    <div className="space-y-3 px-5 py-5">
      {sorted.map((item) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const widthPct = (item.value / max) * 100;
        const isHovered = hovered === item.label;
        return (
          <div
            key={item.label}
            title={`${item.label}: ${formatBRL(item.value)} (${pct.toFixed(0)}% do total)`}
            onMouseEnter={() => setHovered(item.label)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.label)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            className="outline-none"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-sm text-ink truncate">{item.label}</span>
              <span className="font-mono tabular text-sm text-ink shrink-0">
                {formatBRL(item.value)}{" "}
                <span className="text-muted">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-3.5 bg-line/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[filter]"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: "#B3261E",
                  filter: isHovered ? "brightness(1.15)" : "none",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
