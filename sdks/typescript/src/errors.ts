import { ErrorCodes } from './error-codes.js';

/** Options shared by every error constructor. */
export interface TimeManagerErrorOptions {
  /** Dotted lowercase error code. */
  code: string;
  /** Correlation identifier of the request, null when unknown. */
  correlationId?: null | string;
  /** Request path the error relates to, null when unknown. */
  instance?: null | string;
  /** Human readable message for logs; never display it to users. */
  message?: string;
  /** Diagnostic metadata, present outside production only. */
  metadata?: Record<string, unknown>;
  /** HTTP status, 0 for network failures. */
  status: number;
}

/** One field-level validation failure. */
export interface ValidationIssue {
  /** Machine readable failure code, for example `required`. */
  code: string;
  /** Extra parameters of the failure (limits, patterns). */
  params: Record<string, unknown>;
  /** Dotted path of the offending field. */
  path: string;
}

/** Base class of every error thrown by the SDK. */
export class TimeManagerError extends Error {
  /** Dotted lowercase error code, see `ErrorCodes`. */
  public readonly code: string;
  /** Correlation identifier of the request, null when unknown. */
  public readonly correlationId: null | string;
  /** Request path the error relates to, null when unknown. */
  public readonly instance: null | string;
  /** Diagnostic metadata, empty outside development. */
  public readonly metadata: Record<string, unknown>;
  /** HTTP status, 0 for network failures. */
  public readonly status: number;

  public constructor(options: TimeManagerErrorOptions) {
    super(options.message ?? options.code);
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.correlationId = options.correlationId ?? null;
    this.instance = options.instance ?? null;
    this.metadata = options.metadata ?? {};
  }

  /**
   * Builds the matching error from a failed response and its parsed body.
   *
   * @route client.errors.from
   * @param {Response} response
   * @param {unknown} body Body already deserialized to camelCase.
   * @returns {TimeManagerError}
   */
  public static from(response: Response, body: unknown): TimeManagerError {
    const record = isRecord(body) ? body : {};
    const status = response.status;
    const options: TimeManagerErrorOptions = {
      code: typeof record.code === 'string' ? record.code : fallbackCode(status),
      correlationId: typeof record.correlationId === 'string' ? record.correlationId : null,
      instance: typeof record.instance === 'string' ? record.instance : null,
      metadata: isRecord(record.metadata) ? record.metadata : {},
      status,
    };

    if (status === 401) {
      return new AuthenticationError(options);
    }
    if (status === 403) {
      return new ForbiddenError(options);
    }
    if (status === 404) {
      return new NotFoundError(options);
    }
    if (status === 409) {
      return new ConflictError(options);
    }
    if (status === 429) {
      return new RateLimitError({
        ...options,
        retryAfter: TimeManagerError.retryAfter(response, record),
      });
    }
    if (status >= 500) {
      return new ServerError(options);
    }
    if (status === 400) {
      return new ValidationError({ ...options, errors: issues(record.errors) });
    }

    return new TimeManagerError(options);
  }

  private static retryAfter(response: Response, record: Record<string, unknown>): null | number {
    const header = Number(response.headers.get('retry-after'));
    if (Number.isFinite(header) && response.headers.has('retry-after')) {
      return header;
    }

    return typeof record.retryAfter === 'number' ? record.retryAfter : null;
  }
}

/** The access token is missing, invalid or expired (401). */
export class AuthenticationError extends TimeManagerError {}

/** The request conflicts with the current state (409). */
export class ConflictError extends TimeManagerError {}

/** The caller is authenticated but not allowed (403). */
export class ForbiddenError extends TimeManagerError {}

/** The request never reached the API or timed out. */
export class NetworkError extends TimeManagerError {
  /** True when the request was aborted by the SDK timeout. */
  public readonly isTimeout: boolean;

  public constructor(options: { cause?: unknown; isTimeout?: boolean; message?: string }) {
    super({
      code: options.isTimeout === true ? 'network.timeout' : 'network.failed',
      message: options.message,
      status: 0,
    });
    this.isTimeout = options.isTimeout ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** The resource does not exist or is not visible (404). */
export class NotFoundError extends TimeManagerError {}

/** Too many requests (429). */
export class RateLimitError extends TimeManagerError {
  /** Seconds to wait before retrying, null when unknown. */
  public readonly retryAfter: null | number;

  public constructor(options: { retryAfter?: null | number } & TimeManagerErrorOptions) {
    super(options);
    this.retryAfter = options.retryAfter ?? null;
  }
}

/** The API failed unexpectedly (5xx). */
export class ServerError extends TimeManagerError {}

/** The request body or parameters are invalid (400). */
export class ValidationError extends TimeManagerError {
  /** Field-level failures, empty when the API gave none. */
  public readonly errors: ValidationIssue[];

  public constructor(options: { errors?: ValidationIssue[] } & TimeManagerErrorOptions) {
    super(options);
    this.errors = options.errors ?? [];
  }
}

function fallbackCode(status: number): string {
  if (status === 401) {
    return ErrorCodes.TokenAuthenticationFailed;
  }
  if (status === 403) {
    return ErrorCodes.Unauthorized;
  }
  if (status === 404) {
    return ErrorCodes.RouteNotFound;
  }
  if (status === 429) {
    return ErrorCodes.RateLimitExceeded;
  }
  if (status === 400) {
    return ErrorCodes.ValidationError;
  }

  return ErrorCodes.InternalUnexpected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issues(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    code: typeof item.code === 'string' ? item.code : '',
    params: isRecord(item.params) ? item.params : {},
    path: typeof item.path === 'string' ? item.path : '',
  }));
}
