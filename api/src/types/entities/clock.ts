export const CLOCK_SOURCES = ['clock', 'manual'] as const;

export type Clock = {
  clocked_in_at: number;
  clocked_out_at: null | number;
  created_at: number;
  duration_ms: null | number;
  id: string;
  note: null | string;
  object: 'clock';
  source: ClockSource;
  updated_at: null | number;
  user_id: string;
};

export type ClockSource = (typeof CLOCK_SOURCES)[number];
