import type { HttpClient } from '../http.js';
import type { AuthSession, LoginParams, Me } from '../types.js';

/** Authentication and session endpoints (`/v1/auth`). */
export class AuthResource {
  public constructor(private readonly http: HttpClient) {}

  /** Signs in with email and password; the refresh cookie is set by the API. */
  public login(params: LoginParams): Promise<AuthSession> {
    return this.http.post<AuthSession>('/v1/auth/login', params);
  }

  /** Closes the session and clears the refresh cookie. */
  public async logout(): Promise<void> {
    await this.http.post<{ success: boolean }>('/v1/auth/logout');
  }

  /** Returns the signed-in user and the scopes of the current token. */
  public me(): Promise<Me> {
    return this.http.get<Me>('/v1/auth/me');
  }

  /** Absolute URL that starts the Microsoft sign-in flow; navigate the browser to it. */
  public microsoftUrl(): string {
    return this.http.url('/v1/auth/microsoft');
  }

  /** Refreshes the session through the httpOnly cookie, sharing any refresh in flight. */
  public refresh(): Promise<AuthSession> {
    return this.http.refresh();
  }
}
