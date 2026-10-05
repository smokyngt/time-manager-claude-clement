export interface Call {
  body: unknown;
  headers: Record<string, string>;
  init: RequestInit;
  method: string;
  url: string;
}

export type Handler = (call: Call) => Promise<Response> | Response;

export function envelope(data: unknown, code = 'test.ok'): Response {
  return Response.json({
    data,
    event: { code, correlation_id: 'cid', metadata: {}, payload: {} },
    timestamp: 1,
  });
}

export function fakeFetch(handler: Handler): { calls: Call[]; fetch: typeof fetch } {
  const calls: Call[] = [];
  const fake = async (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    const raw = init?.body;
    const call: Call = {
      body: typeof raw === 'string' ? (JSON.parse(raw) as unknown) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
      init: init ?? {},
      method: init?.method ?? 'GET',
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    };
    calls.push(call);

    return handler(call);
  };

  return { calls, fetch: fake as typeof fetch };
}

export function problem(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { code, correlation_id: 'cid', instance: '/v1/x', status, timestamp: 1, ...extra },
    { headers, status },
  );
}
