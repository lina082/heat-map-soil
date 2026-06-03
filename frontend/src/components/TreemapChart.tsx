import { useMemo } from "react";
import { scaleSequential } from "d3-scale";
import { interpolateRdYlBu } from "d3-scale-chromatic";
import type { DistributionBin } from "../types";

/** Parse hex/rgb color string → relative luminance (0–1) */
function luminance(color: string): number {
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/) ??
            color.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 0.5;
  const [r, g, b] = color.startsWith("rgb")
    ? [+m[1] / 255, +m[2] / 255, +m[3] / 255]
    : [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  const lin = (v: number) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function textColor(bgColor: string): string {
  return luminance(bgColor) > 0.35 ? "#1a1a1a" : "#ffffff";
}

interface Props {
  bins: DistributionBin[];
  unit: string;
  label: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  bin: DistributionBin;
}

// Squarified treemap layout — pure TS, no extra lib needed
function squarify(bins: DistributionBin[], W: number, H: number): Rect[] {
  if (!bins.length) return [];

  const sorted = [...bins].sort((a, b) => b.count - a.count);
  const rects: Rect[] = [];

  function layout(items: DistributionBin[], x: number, y: number, w: number, h: number) {
    if (!items.length) return;
    if (items.length === 1) {
      rects.push({ x, y, w, h, bin: items[0] });
      return;
    }

    const totalCount = items.reduce((s, b) => s + b.count, 0);
    // find split that minimises worst aspect ratio
    let best = Infinity;
    let split = 1;
    for (let i = 1; i < items.length; i++) {
      const a = items.slice(0, i).reduce((s, b) => s + b.count, 0) / totalCount;
      const ratio = w >= h
        ? Math.max((w * a) / (h), h / (w * a))
        : Math.max((h * a) / (w), w / (h * a));
      if (ratio < best) { best = ratio; split = i; }
    }

    const frac = items.slice(0, split).reduce((s, b) => s + b.count, 0) / totalCount;

    if (w >= h) {
      const colW = w * frac;
      let cy = y;
      for (const item of items.slice(0, split)) {
        const cellH = h * (item.count / (totalCount * frac));
        rects.push({ x, y: cy, w: colW, h: cellH, bin: item });
        cy += cellH;
      }
      layout(items.slice(split), x + colW, y, w - colW, h);
    } else {
      const rowH = h * frac;
      let cx = x;
      for (const item of items.slice(0, split)) {
        const cellW = w * (item.count / (totalCount * frac));
        rects.push({ x: cx, y, w: cellW, h: rowH, bin: item });
        cx += cellW;
      }
      layout(items.slice(split), x, y + rowH, w, h - rowH);
    }
  }

  layout(sorted, 0, 0, W, H);
  return rects;
}

const W = 700;
const H = 420;
const GAP = 2;

export function TreemapChart({ bins, unit, label }: Props) {
  const rects = useMemo(() => squarify(bins, W, H), [bins]);

  const allValues = bins.map((b) => b.avg_value);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const colorScale = scaleSequential(interpolateRdYlBu).domain([maxVal, minVal]);

  if (!rects.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Sin datos suficientes para mostrar la distribución.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-ink-faint uppercase tracking-widest">{label}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded overflow-hidden"
        style={{ aspectRatio: `${W}/${H}` }}
      >
        {rects.map((r, i) => {
          const gx = r.x + GAP / 2;
          const gy = r.y + GAP / 2;
          const gw = Math.max(r.w - GAP, 1);
          const gh = Math.max(r.h - GAP, 1);
          const fill = colorScale(r.bin.avg_value);
          const tc = textColor(fill);
          const showLabel = gw > 60 && gh > 30;
          const clipId = `clip-${i}`;

          return (
            <g key={i}>
              <clipPath id={clipId}>
                <rect x={gx} y={gy} width={gw} height={gh} />
              </clipPath>
              <rect x={gx} y={gy} width={gw} height={gh} fill={fill} rx={3} />
              {showLabel && (
                <g clipPath={`url(#${clipId})`}>
                  <text
                    x={gx + gw / 2}
                    y={gy + gh / 2 - (gh > 55 ? 14 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={tc}
                    fontSize={Math.min(15, gw / 5)}
                    fontWeight="700"
                    fontFamily="Rubik, system-ui, sans-serif"
                  >
                    {r.bin.avg_value.toFixed(1)} {unit}
                  </text>
                  {gh > 55 && (
                    <>
                      <text
                        x={gx + gw / 2}
                        y={gy + gh / 2 + 6}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={tc}
                        fontSize={Math.min(10, gw / 9)}
                        fontFamily="Rubik, system-ui, sans-serif"
                        opacity={0.65}
                        fontWeight="400"
                      >
                        PROMEDIO
                      </text>
                      <text
                        x={gx + gw / 2}
                        y={gy + gh / 2 + 22}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={tc}
                        fontSize={Math.min(10, gw / 9)}
                        fontFamily="Rubik, system-ui, sans-serif"
                        opacity={0.55}
                        fontWeight="400"
                      >
                        {r.bin.label}
                      </text>
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 mt-2">
        <span className="font-mono text-xs text-ink-faint">menor</span>
        <div className="h-1 flex-1" style={{ background: "linear-gradient(to right, #4575b4, #ffffbf, #d73027)" }} />
        <span className="font-mono text-xs text-ink-faint">mayor</span>
      </div>
      <p className="text-xs text-ink-faint">
        Bloque grande = valor muy común en el campo. Bloque pequeño = zona poco frecuente.
      </p>
    </div>
  );
}
