export interface ErrorDefinition {
  code: string;
  defaultStatus: number;
  message: string;
}

export interface ErrorFactory {
  (options?: ErrorOptions): AppError;
  code: string;
  defaultStatus: number;
}

export interface ErrorOptions {
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly metadata: Record<string, unknown>;
  public readonly status: number;

  public constructor(definition: ErrorDefinition, options: ErrorOptions = {}) {
    super(definition.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = definition.code;
    this.status = definition.defaultStatus;
    this.metadata = options.metadata ?? {};
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

/**
 * @route errors.register
 * @param {ErrorDefinition} definition
 * @returns {ErrorFactory}
 */
export const registerError = (definition: ErrorDefinition): ErrorFactory => {
  const factory = (options: ErrorOptions = {}): AppError => {
    if (AppError.is(options.cause)) return options.cause;
    return new AppError(definition, options);
  };
  factory.code = definition.code;
  factory.defaultStatus = definition.defaultStatus;
  return factory;
};

export const UnauthorizedError = registerError({
  code: 'UNAUTHORIZED',
  defaultStatus: 401,
  message: 'Authentication is required or the credentials are invalid.',
});

export const ForbiddenError = registerError({
  code: 'FORBIDDEN',
  defaultStatus: 403,
  message: 'You are not allowed to perform this action.',
});

export const ValidationError = registerError({
  code: 'VALIDATION_ERROR',
  defaultStatus: 400,
  message: 'The request is invalid.',
});

export const RateLimitError = registerError({
  code: 'RATE_LIMITED',
  defaultStatus: 429,
  message: 'Too many requests. Please retry later.',
});

export const NotFoundError = registerError({
  code: 'NOT_FOUND',
  defaultStatus: 404,
  message: 'The requested resource does not exist.',
});

export const InternalError = registerError({
  code: 'INTERNAL_ERROR',
  defaultStatus: 500,
  message: 'An unexpected error occurred.',
});
