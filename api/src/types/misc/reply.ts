export type ErrorDetail = {
  code: string;
  params: Record<string, unknown>;
  path: string;
};

export type ErrorEnvelope = {
  code: string;
  correlation_id: string;
  errors?: ErrorDetail[];
  instance: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  status: number;
  timestamp: number;
};

export type ReplyEnvelope<Data> = {
  data: Data;
  event: ReplyEvent;
  timestamp: number;
};

export type ReplyEvent = {
  code: string;
  correlation_id: string;
  metadata: Record<string, unknown>;
  payload: unknown;
};
