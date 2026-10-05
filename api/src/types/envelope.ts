export interface ReplyEnvelope<Data> {
  data: Data;
  event: string;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
  request_id: string;
  status: number;
}
