/** Shared prop types for the Metrics Hub chart components. */
export interface TrendSeries {
  key: string;
  label: string;
  values: Array<number | null>;
  kind?: 'bar' | 'line';
  color?: string;
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Printed value for the bar column. */
  display: string;
  /** Extra columns, aligned with `columns`. */
  cells?: string[];
  /** Optional status tone for the first extra cell. */
  tone?: 'good' | 'bad' | null;
  muted?: boolean;
  title?: string;
}

export interface HeatCell { value: number | null; display: string; n: number; title?: string }
