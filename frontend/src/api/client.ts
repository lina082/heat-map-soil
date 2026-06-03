import type { CellDetail, DistributionBin, GridResponse, LiveStatus, Run, RunStats, VariableMeta } from "../types";

const BASE = "/api/v1";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  runs: {
    list: () => get<Run[]>("/runs"),
    get: (runId: string) => get<Run>(`/runs/${runId}`),
    stats: (runId: string) => get<RunStats[]>(`/runs/${runId}/stats`),
    distribution: (runId: string, variable: string, bins = 12) =>
      get<DistributionBin[]>(`/runs/${runId}/distribution?variable=${variable}&bins=${bins}`),
  },
  grid: {
    get: (runId: string, variable: string) =>
      get<GridResponse>(`/runs/${runId}/grid?variable=${variable}`),
    cell: (runId: string, x: number, y: number) =>
      get<CellDetail>(`/runs/${runId}/cell?x=${x}&y=${y}`),
    timeseries: (runId: string, x: number, y: number, variable: string) =>
      get(`/runs/${runId}/timeseries?x=${x}&y=${y}&variable=${variable}`),
  },
  live: {
    status: () => get<LiveStatus>("/live/status"),
  },
  variables: {
    list: () => get<VariableMeta[]>("/variables"),
  },
};
