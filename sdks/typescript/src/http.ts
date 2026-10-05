import { ErrorCodes } from './error-codes.js';
import { AuthenticationError, NetworkError, TimeManagerError } from './errors.js';
import { Payload } from './payload.js';

import type { AuthSession } from './types.js';

/** Options of `HttpClient`. */
export interface HttpClientOptions {
  /** API origin without trailing slash; empty string means same origin. */
  baseUrl: string;
  /** Custom `fetch`, defaults to the global one. */
  fetch?: typeof fetch;
  /** Returns the current access token, null when signed out. */
  getToken: () => null | string;
  /** Called when the refresh failed and the session is over. */
  onLogout?: () => void;
  /** Called with the new access token and session after a successful refresh. */
  onTokenRefresh?: (token: string, session: AuthSession) => void;
  /** Request timeout in milliseconds, default 15000. */
  timeoutMs?: number;
}

const REFRESH_PATH = '/v1/auth/refresh';
const NO_REFRESH_PATHS = ['/v1/auth/login', REFRESH_PATH, '/v1/auth/logout'];

/**
 * JSON transport: bearer token, case conversion, envelope unwrapping, timeout and single-flight
 * token refresh.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: (input: string, init: RequestInit) => Promise<Response>;
  private readonly getToken: () => null | string;
  private readonly onLogout: (() => void) | undefined;
  private readonly onTokenRefresh: ((token: string, session: AuthSession) => void) | undefined;
  private refreshing: null | Promise<AuthSession> = null;
  private readonly timeoutMs: number;

  public constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetcher =
      options.fetch ??
      ((input: string, init: RequestInit): Promise<Response> => globalThis.fetch(input, init));
    this.getToken = options.getToken;
    this.onTokenRefresh = options.onTokenRefresh;
    this.onLogout = options.onLogout;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private static expired(error: unknown): boolean {
    return (
      error instanceof AuthenticationError && error.code === ErrorCodes.TokenAuthenticationFailed
    );
  }

  /** Sends a DELETE request and returns the unwrapped data. */
  public delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }

  /** Sends a GET request and returns the unwrapped data. */
  public get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /** Sends a PATCH request and returns the unwrapped data. */
  public patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /** Sends a POST request and returns the unwrapped data. */
  public post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Refreshes the session through the httpOnly cookie. Concurrent calls share one request.
   *
   * @route client.http.refresh
   * @returns {Promise<AuthSession>}
   */
  public refresh(): Promise<AuthSession> {
    this.refreshing ??= this.performRefresh().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  /** Absolute URL of a path, used for browser redirects. */
  public url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async dispatch(method: string, path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const state = { timedOut: false };
    const timer = setTimeout(() => {
      state.timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.getToken();
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }
    const init: RequestInit = {
      credentials: 'include',
      headers,
      method,
      signal: controller.signal,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(Payload.serialize(body));
    }

    try {
      return await this.fetcher(this.url(path), init);
    } catch (error) {
      throw new NetworkError({
        cause: error,
        isTimeout: state.timedOut,
        message: state.timedOut
          ? `Request timed out after ${this.timeoutMs}ms`
          : 'Network request failed',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async performRefresh(): Promise<AuthSession> {
    try {
      const session = await this.send<AuthSession>('POST', REFRESH_PATH, undefined);
      this.onTokenRefresh?.(session.accessToken, session);

      return session;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      this.onLogout?.();
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError({
        code: error instanceof TimeManagerError ? error.code : ErrorCodes.TokenAuthenticationFailed,
        correlationId: error instanceof TimeManagerError ? error.correlationId : null,
        status: 401,
      });
    }
  }

  private async read(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text === '') {
      return undefined;
    }
    try {
      return Payload.deserialize(JSON.parse(text));
    } catch {
      return undefined;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const retryable = !NO_REFRESH_PATHS.includes(path);
    try {
      return await this.send<T>(method, path, body);
    } catch (error) {
      if (!retryable || !HttpClient.expired(error)) {
        throw error;
      }
      await this.refresh();

      return this.send<T>(method, path, body);
    }
  }

  private async send<T>(method: string, path: string, body: unknown): Promise<T> {
    const response = await this.dispatch(method, path, body);
    const parsed = await this.read(response);
    if (!response.ok) {
      throw TimeManagerError.from(response, parsed);
    }
    if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
      return (parsed as { data: T }).data;
    }

    return undefined as T;
  }
}
