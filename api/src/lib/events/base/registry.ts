export type AppEvent<Payload> = {
  code: string;
  metadata: Record<string, unknown>;
  payload: Payload;
};

export type EventFactory<Payload> = ((options: EventOptions<Payload>) => AppEvent<Payload>) & {
  code: string;
};

export type EventOptions<Payload> = {
  metadata?: Record<string, unknown>;
  payload: Payload;
};

/**
 * @route events.register
 * @param {{ code: string }} definition
 * @returns {EventFactory<Payload>}
 */
export const registerEvent = <Payload>(definition: { code: string }): EventFactory<Payload> => {
  const factory = (options: EventOptions<Payload>): AppEvent<Payload> => ({
    code: definition.code,
    metadata: options.metadata ?? {},
    payload: options.payload,
  });
  factory.code = definition.code;

  return factory;
};
