export interface Run {
  run_id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  total_measurements: number;
  status: "active" | "completed";
  label: string | null;
}

export interface GridCell {
  x: number;
  y: number;
  value: number;
}

export interface GridResponse {
  run_id: string;
  variable: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  grid: GridCell[];
}

export interface CellDetail {
  run_id: string;
  x_m: number;
  y_m: number;
  timestamp: string;
  latitud: number;
  longitud: number;
  humedad_suelo_pct: number;
  temperatura_suelo_c: number;
  intensidad_luz: number;
  lluvia_mm_h: number;
  temperatura_ambiente_c: number;
  distancia_rio_m: number;
  influencia_rio: number;
  retencion_suelo: number;
  drenaje: number;
  sombra: number;
  indice_recorrido: number;
}

export interface VariableMeta {
  key: string;
  label: string;
  unit: string;
  description: string;
}

export interface LiveStatus {
  online: boolean;
  run_id: string | null;
  device_id: string | null;
  last_x: number | null;
  last_y: number | null;
  indice_recorrido: number | null;
  progress_pct: number | null;
  last_seen: string | null;
}

export interface RunStats {
  variable: string;
  avg: number;
  min: number;
  max: number;
  median: number;
  stddev: number;
}

export interface DistributionBin {
  bucket: number;
  count: number;
  avg_value: number;
  bin_min: number;
  bin_max: number;
  label: string;
}

export interface WsMessage {
  type: "measurement" | "run_started" | "run_completed" | "robot_online" | "robot_offline";
  data: Record<string, unknown>;
}
