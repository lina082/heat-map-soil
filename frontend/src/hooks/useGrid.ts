import { useState, useCallback } from "react";
import type { GridCell } from "../types";

export type GridMap = Map<string, number>;

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function useGrid() {
  const [grid, setGrid] = useState<GridMap>(new Map());
  const [min, setMin] = useState(Infinity);
  const [max, setMax] = useState(-Infinity);

  const loadGrid = useCallback((cells: GridCell[], dataMin: number, dataMax: number) => {
    const map = new Map<string, number>();
    for (const c of cells) {
      map.set(key(c.x, c.y), c.value);
    }
    setGrid(map);
    setMin(dataMin);
    setMax(dataMax);
  }, []);

  const addCell = useCallback((x: number, y: number, value: number) => {
    setGrid((prev) => {
      const next = new Map(prev);
      next.set(key(x, y), value);
      return next;
    });
    setMin((prev) => Math.min(prev, value));
    setMax((prev) => Math.max(prev, value));
  }, []);

  const reset = useCallback(() => {
    setGrid(new Map());
    setMin(Infinity);
    setMax(-Infinity);
  }, []);

  return { grid, min, max, loadGrid, addCell, reset };
}
