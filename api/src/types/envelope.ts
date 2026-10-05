export interface ErrorEnvelope {
  code: string;
  message: string;
  request_id: string;
  status: number;
}

export interface ReplyEnvelope<Data> {
  data: Data;
  event: string;
}
