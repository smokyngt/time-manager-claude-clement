export type ErrorDefinition = {
  code: string;
  defaultStatus: number;
};

export type ErrorFactory = ((options?: ErrorOptions) => AppError) & {
  code: string;
  defaultStatus: number;
};

export type ErrorOptions = {
  cause?: unknown;
  correlation_id?: string;
  instance?: string;
  mergeCauseMetadata?: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
  retry_after?: number;
  status?: number;
};

export type Metadata = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: string;
  public readonly correlation_id: string | undefined;
  public readonly instance: string | undefined;
  public readonly metadata: Metadata;
  public readonly retry_after: number | undefined;
  public readonly status: number;

  public constructor(definition: ErrorDefinition, options: { metadata: Metadata } & ErrorOptions) {
    super(options.message ?? definition.code, { cause: options.cause });
    this.name = 'AppError';
    this.code = definition.code;
    this.status = options.status ?? definition.defaultStatus;
    this.metadata = options.metadata;
    this.correlation_id = options.correlation_id;
    this.instance = options.instance;
    this.retry_after = options.retry_after;
  }

  /**
   * @route errors.app.is
   * @param {unknown} value
   * @returns {boolean}
   */
  public static is(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}

export class Registry {
  private static readonly entries = new Map<string, ErrorDefinition>();

  /**
   * @route errors.registry.get
   * @param {string} code
   * @returns {ErrorDefinition | undefined}
   */
  public static get(code: string): ErrorDefinition | undefined {
    return Registry.entries.get(code);
  }

  /**
   * @route errors.registry.has
   * @param {string} code
   * @returns {boolean}
   */
  public static has(code: string): boolean {
    return Registry.entries.has(code);
  }

  /**
   * @route errors.registry.sanitize
   * @param {unknown} value
   * @returns {Metadata}
   */
  public static sanitize(value: Metadata): Metadata {
    const seen = new WeakSet<object>();
    try {
      const text = JSON.stringify(value, (_key, item: unknown) => {
        if (typeof item === 'bigint') return item.toString();
        if (item instanceof Error) return { message: item.message, name: item.name };
        if (typeof item === 'function' || typeof item === 'symbol') return undefined;
        if (typeof item === 'object' && item !== null) {
          if (seen.has(item)) return '[circular]';
          seen.add(item);
        }

        return item;
      });

      return JSON.parse(text) as Metadata;
    } catch {
      return {};
    }
  }

  /**
   * @route errors.registry.set
   * @param {ErrorDefinition} definition
   * @returns {void}
   * @throws {Error}
   */
  public static set(definition: ErrorDefinition): void {
    const existing = Registry.entries.get(definition.code);
    if (existing !== undefined && existing.defaultStatus !== definition.defaultStatus) {
      throw new Error(
        `Error code "${definition.code}" is already registered with status ${existing.defaultStatus}`,
      );
    }
    Registry.entries.set(definition.code, definition);
  }
}

/**
 * @route errors.register
 * @param {ErrorDefinition} definition
 * @returns {ErrorFactory}
 * @throws {Error}
 */
export const registerError = (definition: ErrorDefinition): ErrorFactory => {
  Registry.set(definition);
  const factory = (options: ErrorOptions = {}): AppError => {
    const { cause } = options;
    const override =
      options.status !== undefined ||
      options.message !== undefined ||
      options.correlation_id !== undefined;
    if (AppError.is(cause) && !override) return cause;
    const inherited =
      options.mergeCauseMetadata === true && AppError.is(cause) ? cause.metadata : {};

    return new AppError(definition, {
      ...options,
      metadata: Registry.sanitize({ ...inherited, ...options.metadata }),
    });
  };
  factory.code = definition.code;
  factory.defaultStatus = definition.defaultStatus;

  return factory;
};
