"use client";

import { useState } from "react";
import { formatMoney, type CurrencyConfig } from "@/lib/money";

function compactMoney(minor: number, currency: CurrencyConfig): string {
  try {
    return new Intl.NumberFormat(currency.locale, { style: "currency", currency: currency.code, notation: "compact", maximumFractionDigits: 1 }).format(minor / 10 ** currency.decimals);
  } catch {
    return formatMoney(minor, currency);
  }
}

/**
 * Single-series column chart (verified revenue over time).
 * One hue (olive) on a recessive grid; 4px rounded data-ends; hover/focus
 * shows a tooltip; a table view is provided alongside for screen readers.
 */
export function ColumnChart({ data, currency, title }: { data: { key: string; label: string; value: number }[]; currency: CurrencyConfig; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const formatValue = (v: number) => formatMoney(v, currency);
  const width = 720;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 0);
  const niceMax = max === 0 ? 1 : niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(2, band - 2));
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((tick) => {
          const y = pad.top + innerH - (tick / niceMax) * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e4dccf" strokeWidth={1} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5e554d" style={{ fontVariantNumeric: "tabular-nums" }}>
                {compactMoney(tick, currency)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / niceMax) * innerH;
          const x = pad.left + i * band + (band - barW) / 2;
          const y = pad.top + innerH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.key}>
              {h > 0 ? (
                <path
                  d={`M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`}
                  fill={active === null || active === i ? "#3e4a2f" : "#8f9a7e"}
                />
              ) : null}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${formatValue(d.value)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
              {i % labelEvery === 0 ? (
                <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#5e554d">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#bfb3a3" strokeWidth={1} />
      </svg>
      {active !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lift"
          style={{ left: `${((pad.left + active * band + band / 2) / width) * 100}%`, transform: "translateX(-50%)" }}
          role="status"
        >
          <p className="text-white/70">{data[active].label}</p>
          <p className="text-sm font-semibold">{formatValue(data[active].value)}</p>
        </div>
      ) : null}
    </div>
  );
}

function niceCeil(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}
