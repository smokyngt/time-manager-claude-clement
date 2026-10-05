export interface AppEvent<Payload> {
  code: string;
  metadata: Record<string, unknown>;
  payload: Payload;
}

export interface EventOptions<Payload> {
  metadata?: Record<string, unknown>;
  payload: Payload;
}

export type EventFactory<Payload> = ((options: EventOptions<Payload>) => AppEvent<Payload>) & {
  code: string;
};

/**
 * @route events.register
 * @param {string} code
 * @returns {EventFactory<Payload>}
 */
export const registerEvent = <Payload>(code: string): EventFactory<Payload> => {
  const factory = (options: EventOptions<Payload>): AppEvent<Payload> => ({
    code,
    metadata: options.metadata ?? {},
    payload: options.payload,
  });
  factory.code = code;
  return factory;
};
