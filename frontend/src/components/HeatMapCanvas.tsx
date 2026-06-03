import { useEffect, useRef } from "react";
import { scaleSequential, scaleLinear } from "d3-scale";
import { interpolateRdYlBu } from "d3-scale-chromatic";
import type { GridMap } from "../hooks/useGrid";

interface Props {
  grid: GridMap;
  min: number;
  max: number;
  unit: string;
  robotX: number | null;
  robotY: number | null;
  onCellClick: (x: number, y: number) => void;
}

const GRID_SIZE = 100;
const CELL_PX = 7;
const LEGEND_W = 56;
const LEGEND_BAR_W = 16;
const LEGEND_PAD = 8;
const CANVAS_W = GRID_SIZE * CELL_PX + LEGEND_W;
const CANVAS_H = GRID_SIZE * CELL_PX;
const LEGEND_STEPS = 10;

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (v: number) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// d3 interpolateRdYlBu returns rgb(...) strings — convert to hex for luminance check
function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#888888";
  return "#" + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
}

export function HeatMapCanvas({ grid, min, max, unit, robotX, robotY, onCellClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dark = isDark();
    const emptyColor = dark ? "#1e1e1e" : "#d4d4d4";
    const bgColor = dark ? "#111111" : "#f5f5f5";
    const textMuted = dark ? "#a3a3a3" : "#525252";
    const range = max - min;
    const colorScale = scaleSequential(interpolateRdYlBu).domain([max, min]);

    // background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // --- grid cells ---
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const value = grid.get(`${x},${y}`);
        const hasValue = value !== undefined && range > 0;
        const fillRgb = hasValue ? colorScale(value!) : emptyColor;
        ctx.fillStyle = fillRgb;
        ctx.fillRect(x * CELL_PX + 1, y * CELL_PX + 1, CELL_PX - 1, CELL_PX - 1);

        // value label — only when cell large enough (CELL_PX >= 14)
        if (hasValue && CELL_PX >= 14 && value !== undefined) {
          const hex = rgbToHex(fillRgb);
          ctx.fillStyle = luminance(hex) > 0.35 ? "#111111" : "#ffffff";
          ctx.font = `bold ${Math.floor(CELL_PX * 0.55)}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            value.toFixed(1),
            x * CELL_PX + CELL_PX / 2,
            y * CELL_PX + CELL_PX / 2,
          );
        }
      }
    }

    // --- robot dot ---
    if (robotX !== null && robotY !== null) {
      const cx = robotX * CELL_PX + CELL_PX / 2;
      const cy = robotY * CELL_PX + CELL_PX / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#ffffff" : "#111111";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "#16a34a";
      ctx.fill();
    }

    // --- vertical legend ---
    const legendX = GRID_SIZE * CELL_PX + LEGEND_PAD;
    const legendBarH = CANVAS_H - 40;
    const legendBarX = legendX;
    const legendBarY = 20;

    // gradient bar
    for (let i = 0; i < legendBarH; i++) {
      const t = i / legendBarH; // 0=top=max, 1=bottom=min
      ctx.fillStyle = colorScale(min + (1 - t) * range);
      ctx.fillRect(legendBarX, legendBarY + i, LEGEND_BAR_W, 1);
    }

    // border around legend bar
    ctx.strokeStyle = dark ? "#333333" : "#aaaaaa";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(legendBarX, legendBarY, LEGEND_BAR_W, legendBarH);

    // tick marks + labels
    const labelScale = scaleLinear().domain([0, LEGEND_STEPS]).range([max, min]);
    ctx.font = `10px "IBM Plex Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textMuted;

    for (let i = 0; i <= LEGEND_STEPS; i++) {
      const yPos = legendBarY + (i / LEGEND_STEPS) * legendBarH;
      const val = labelScale(i);
      // tick
      ctx.beginPath();
      ctx.moveTo(legendBarX + LEGEND_BAR_W, yPos);
      ctx.lineTo(legendBarX + LEGEND_BAR_W + 4, yPos);
      ctx.strokeStyle = textMuted;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // label
      ctx.fillText(`${val.toFixed(1)}`, legendBarX + LEGEND_BAR_W + 6, yPos);
    }

    // unit label at top of legend
    ctx.save();
    ctx.translate(legendBarX + LEGEND_BAR_W / 2, legendBarY - 8);
    ctx.font = `bold 9px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = textMuted;
    ctx.fillText(unit, 0, 0);
    ctx.restore();

  }, [grid, min, max, unit, robotX, robotY]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    if (rawX > GRID_SIZE * CELL_PX) return; // clicked legend area
    const x = Math.floor(rawX / CELL_PX);
    const y = Math.floor(rawY / CELL_PX);
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      onCellClick(x, y);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={handleClick}
      className="w-full cursor-crosshair"
      style={{ imageRendering: "pixelated", aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
    />
  );
}
