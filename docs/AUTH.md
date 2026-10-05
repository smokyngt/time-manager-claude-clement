# Authentication

Time Manager uses short-lived JWT access tokens, rotating refresh tokens in an httpOnly cookie, and optional Microsoft sign-in (OAuth 2.0 authorization code flow with PKCE). There is no public signup. Shared conventions are in [CONTRACT.md](CONTRACT.md); roles and scopes are in [ROLES.md](ROLES.md).

Endpoints (all under `/v1/auth`):

| Method & path | Scope | Purpose |
|---|---|---|
| `POST /login` | none (rate limited, 10/min per IP by default) | Email and password sign-in |
| `POST /refresh` | none (cookie) | Rotate the refresh token, issue a new access token |
| `POST /logout` | `auth:self` | Revoke the current refresh-token family |
| `GET /me` | `auth:self` | Current user |
| `GET /microsoft` | none | Start Microsoft sign-in (302 to Microsoft) |
| `GET /microsoft/callback` | none | Finish Microsoft sign-in (302 to the SPA) |

## 1. Tokens

### Access token

- JWT signed with HS256 using `JWT_ACCESS_SECRET` (`jose`).
- Claims: `sub` (user id), `role`, `iss = time-manager`, `aud = time-manager-web`, `iat`, `exp`.
- Lifetime `JWT_ACCESS_TTL` (default `15m`).
- Returned in the JSON body (`data.access_token`, `expires_in`, `token_type: "Bearer"`, `user`). The SPA keeps it in memory only (never `localStorage`) and sends `Authorization: Bearer <token>`.
- Verified on every protected request by the `auth({ scopes })` preHandler: signature, issuer, audience, expiry, and a valid `role`. The role is mapped to scopes server side (`config/auth/roles.ts`); scopes are not stored in the token, so changing a role mapping needs no token migration (a role change takes effect when the token is next refreshed).

### Refresh token

- Opaque: 32 random bytes, base64url. Not a JWT.
- Lifetime `JWT_REFRESH_TTL` (default `7d`).
- Stored only as an HMAC-SHA256 hash (key `JWT_REFRESH_SECRET`) in `refresh_tokens.token_hash` (unique). A database leak does not reveal usable tokens.
- Each row has a `family_id` (one family per login), `expires_at`, `revoked_at`.

### Cookie

| Cookie | Value | Flags | Path | Lifetime |
|---|---|---|---|---|
| `tm_refresh` | refresh token | `HttpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production` | `/v1/auth` | `JWT_REFRESH_TTL` |
| `tm_oauth` | signed OAuth state (Microsoft flow only) | `HttpOnly`, `SameSite=Lax`, `Secure` in production | `/v1/auth/microsoft` | 10 minutes |

Scoping `tm_refresh` to `/v1/auth` means the browser sends it only to the auth endpoints, not to every API call. `HttpOnly` keeps it away from JavaScript (XSS cannot read it). `SameSite=Lax` blocks it on cross-site POSTs (CSRF) while still allowing the top-level redirect back from Microsoft. CORS is enabled with `credentials: true` for the origins in `CORS_ORIGIN`.

## 2. Rotation and reuse detection

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (SPA)
    participant A as API
    participant D as PostgreSQL

    Note over B,D: Login
    B->>A: POST /v1/auth/login { email, password }
    A->>D: SELECT user; argon2id verify
    A->>D: INSERT refresh_tokens (hash T1, family F)
    A-->>B: 200 { access_token } + Set-Cookie tm_refresh=T1

    Note over B,D: Normal rotation (also on SPA boot, and after a 401)
    B->>A: POST /v1/auth/refresh (cookie T1)
    A->>D: find row by hash(T1)
    A->>D: UPDATE ... SET revoked_at=now WHERE id AND revoked_at IS NULL
    A->>D: INSERT refresh_tokens (hash T2, family F)
    A-->>B: 200 { access_token } + Set-Cookie tm_refresh=T2

    Note over B,D: Replay of a rotated token
    B->>A: POST /v1/auth/refresh (cookie T1 again)
    A->>D: row for T1 already has revoked_at
    A->>D: revoke every token of family F
    A->>D: audit_logs auth.refresh_reuse_detected
    A-->>B: 401 AUTH_SESSION_INVALID + cookie cleared
```

Rules implemented in `services/auth/refresh.ts` and `session.ts`:

1. The presented token is hashed and looked up. Unknown: `AUTH_SESSION_INVALID` (401).
2. If it is unrevoked and unexpired, it is claimed atomically with a conditional `UPDATE ... WHERE revoked_at IS NULL`. Only one concurrent request can win; the loser falls through to the reuse path.
3. A new token is issued in the same family, so one login equals one chain of tokens.
4. **Reuse detection**: presenting a token that is already revoked (or that lost the race) revokes the whole family and writes `auth.refresh_reuse_detected`. A thief and the legitimate user cannot both keep a session; the legitimate user has to sign in again. An expired token also revokes its family.
5. Archived or deleted users cannot refresh; their family is revoked.
6. On any refresh failure the controller clears the `tm_refresh` cookie.
7. `POST /logout` revokes the family of the cookie's token (if it belongs to the caller), writes `auth.logged_out`, and the SPA discards its in-memory token.

Tokens are never extended silently: the absolute session limit is bounded by token rotation, and an inactive browser's refresh token simply expires after `JWT_REFRESH_TTL`.

### Client behavior (web)

- On boot, `AuthProvider` calls `POST /v1/auth/refresh` then `GET /v1/auth/me`; success means the user is signed in, failure means the login page.
- `createAuthFetch` (`web/src/lib/api/auth-fetch.ts`) attaches the bearer token and, on a 401, calls `refreshSession()` once and retries the request. Concurrent refreshes are coalesced into one promise. If refresh fails, the session is cleared. `login`, `refresh` and `logout` are excluded from the retry.

### Passwords

Hashed with argon2id (`Bun.password`). A dummy hash is verified when the email is unknown so response time does not reveal which emails exist, and all credential failures return the same `AUTH_INVALID_CREDENTIALS` (401). Archived users cannot sign in.

## 3. Microsoft OAuth 2.0 with PKCE

Microsoft sign-in is optional. Without `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`, `/v1/auth/microsoft` answers `503 AUTH_MICROSOFT_UNAVAILABLE`. Scopes requested: `openid profile email`.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant S as SPA (WEB_URL)
    participant A as API
    participant M as Microsoft identity platform
    participant D as PostgreSQL

    B->>S: click "Sign in with Microsoft"
    S->>A: GET /v1/auth/microsoft (navigation)
    A->>A: random state, nonce, code_verifier; challenge = BASE64URL(SHA256(verifier))
    A->>A: tm_oauth = signed JWT { state, nonce, verifier } (10 min)
    A-->>B: 302 to login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?...code_challenge, state, nonce + Set-Cookie tm_oauth
    B->>M: user authenticates and consents
    M-->>B: 302 to MICROSOFT_REDIRECT_URI ?code=...&state=...
    B->>A: GET /v1/auth/microsoft/callback (+ tm_oauth cookie)
    A->>A: verify tm_oauth signature and expiry; state equals query state
    A->>M: POST /token { code, code_verifier, client_id, client_secret, redirect_uri }
    M-->>A: id_token
    A->>A: check aud = client_id, nonce, exp, issuer is login.microsoftonline.com
    A->>D: find user by microsoft_id = oid, else by lower(email)
    alt no such user
        A-->>B: 302 WEB_URL/auth/callback?error=AUTH_MICROSOFT_UNKNOWN_USER
    else user found and not archived
        A->>D: link microsoft_id on first login (audit auth.microsoft_linked)
        A->>D: INSERT refresh_tokens (new family)
        A-->>B: 302 WEB_URL/auth/callback + Set-Cookie tm_refresh
        B->>S: load /auth/callback
        S->>A: POST /v1/auth/refresh (cookie)
        A-->>S: access_token
    end
```

Security properties:

- **PKCE (S256)**: the `code_verifier` never leaves the API/cookie; Microsoft receives only the challenge on the way out, so an intercepted authorization code is useless without the verifier.
- **State**: random, bound to the browser through the signed `tm_oauth` cookie; the callback rejects a mismatch (login CSRF).
- **Nonce**: random, echoed in the `id_token`; a replayed token is rejected.
- **State cookie integrity**: it is a JWT signed with `JWT_REFRESH_SECRET`, audience `oauth-state`, expiring in 10 minutes, and cleared at the start of the callback.
- **ID token checks**: audience equals the client id, nonce equal, not expired, issuer under `https://login.microsoftonline.com/`. The token is received directly from Microsoft's token endpoint over TLS in exchange for the code and client secret, which is why signature verification against Microsoft's JWKS is not repeated.
- **Failures** never show an API error page to the user: the callback redirects to `WEB_URL/auth/callback?error=<CODE>` and the SPA displays a message. The only exception is `AUTH_MICROSOFT_UNAVAILABLE` (503).

### Account linking rules

- **No auto-signup.** Microsoft sign-in only works for a user that a manager or admin already created through `POST /v1/users/new`. An unknown identity gets `AUTH_MICROSOFT_UNKNOWN_USER` (403). This keeps the company's user list authoritative and roles under human control.
- Lookup order: `users.microsoft_id` equal to the token `oid` (falls back to `sub` if `oid` is absent); if not found, the email (`email`, else `preferred_username`, lowercased).
- First match by email links the account: `microsoft_id` is stored and `auth.microsoft_linked` is audited. After that the account is matched by `oid`, so a later email change at Microsoft does not matter.
- If the email-matched user is already linked to a different Microsoft identity, the sign-in is rejected (`AUTH_MICROSOFT_REJECTED`, 401).
- Archived users are rejected.
- Linking by email trusts the email claim. To prevent an account from another tenant claiming a company address, set `MICROSOFT_TENANT_ID` to your own tenant id instead of `common`: the authorize and token endpoints are then tenant-specific and only that directory can authenticate.
- The role and profile always come from the Time Manager database, never from Microsoft.
- A user created by a manager has no password (`password_hash` null) unless one is set; such a user can only sign in with Microsoft, and the reverse also holds.

### Why OAuth tokens are never stored

The API uses Microsoft only to learn who the user is, once. After the code exchange, the Microsoft `access_token`, `refresh_token` and `id_token` are discarded; only the stable identifier (`oid`) is saved in `users.microsoft_id`. Reasons:

- Time Manager never calls Microsoft APIs on the user's behalf, so it has no use for those tokens.
- Stored tokens would be long-lived credentials for a third-party system; a database leak would expose them. Not storing them removes that risk.
- Sessions are our own: after the exchange, the user gets the same access/refresh pair as a password login, so revocation, rotation and expiry follow one policy. Revoking a Time Manager session does not depend on Microsoft.

## 4. Secrets handling

| Secret | Used for |
|---|---|
| `JWT_ACCESS_SECRET` | Signing access tokens |
| `JWT_REFRESH_SECRET` | HMAC of refresh tokens; signing the `tm_oauth` state cookie |
| `MICROSOFT_CLIENT_SECRET` | Authorization code exchange |
| `POSTGRES_PASSWORD`, `SEED_ADMIN_PASSWORD` | Database and first admin |

Rules:

- Secrets live in `.env` files, which are git-ignored. Root `.gitignore` contains `.env` and `.env.*` with the exception `!.env.example`; `api/.gitignore` also ignores `.env`. Only `.env.example` (placeholders `CHANGE_ME_...`) is committed.
- Create your file with `cp .env.example .env` and replace every `CHANGE_ME`. Generate secrets with `openssl rand -hex 32`.
- Use two different values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- In production (`NODE_ENV=production`) `Config.validate()` requires both JWT secrets to be at least 32 characters and `DATABASE_URL` to be set; the server refuses to start otherwise. `docker-compose.yml` additionally fails with `:?` errors when `POSTGRES_*` or the JWT secrets are unset.
- Outside production, missing JWT secrets fall back to a built-in `dev-only-...` value so tests and local runs work. Never rely on this in a deployed environment.
- Secrets are never baked into images (only `VITE_API_URL`, which is public, is a web build argument) and never logged; logs carry ids only.
- If a secret is committed by mistake, treat it as compromised: rotate it, and rewrite history only after rotation. Rotating `JWT_REFRESH_SECRET` invalidates all refresh tokens (everybody signs in again); rotating `JWT_ACCESS_SECRET` invalidates access tokens within `JWT_ACCESS_TTL`.
- Create `.env` files outside CI/CD pipelines through the platform's secret store (GitHub Actions secrets, Docker secrets or your host's equivalent). The CI workflow uses throwaway values.

## 5. Register the Azure (Microsoft Entra ID) application

You need an account that can create app registrations in your tenant.

1. Open https://portal.azure.com and go to **Microsoft Entra ID** > **App registrations** > **New registration**.
2. **Name**: `Time Manager` (any name).
3. **Supported account types**: choose **Accounts in this organizational directory only (Single tenant)**. This matches `MICROSOFT_TENANT_ID=<your tenant id>`. Use multi-tenant only if you accept users from other organizations (then keep the account-linking caveat above in mind).
4. **Redirect URI**: platform **Web**, value must match `MICROSOFT_REDIRECT_URI` exactly:
   - Local API: `http://localhost:8000/v1/auth/microsoft/callback`
   - Production stack via nginx: `http://localhost:8080/v1/auth/microsoft/callback` (compose default), or `https://<your-domain>/v1/auth/microsoft/callback` in a real deployment.
   Microsoft allows `http` only for `localhost`; use HTTPS elsewhere.
5. Click **Register**. On the **Overview** page copy:
   - **Application (client) ID** to `MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** to `MICROSOFT_TENANT_ID`
6. Go to **Certificates & secrets** > **Client secrets** > **New client secret**. Pick a description and an expiry, click **Add**, and copy the secret **Value** (not the Secret ID) immediately; it is shown only once. Put it in `MICROSOFT_CLIENT_SECRET`. Note the expiry date: the secret stops working then, so schedule a rotation.
7. **API permissions**: the default Microsoft Graph `User.Read` (delegated) is enough; `openid`, `profile` and `email` are standard OIDC scopes. No admin consent is required for these.
8. Put the values in `.env` (never in git):

   ```
   MICROSOFT_CLIENT_ID=<application id>
   MICROSOFT_CLIENT_SECRET=<secret value>
   MICROSOFT_TENANT_ID=<directory id>
   MICROSOFT_REDIRECT_URI=http://localhost:8000/v1/auth/microsoft/callback
   WEB_URL=http://localhost:5173
   ```

   `WEB_URL` is where the API redirects the browser after the callback (`/auth/callback`). `CORS_ORIGIN` must include the SPA origin.
9. Restart the API and open the login page. Make sure a user with the same email exists first (created by a manager or by `make seed` for the admin); otherwise sign-in ends in `AUTH_MICROSOFT_UNKNOWN_USER`.

Common errors: `AADSTS50011` (redirect URI mismatch: copy it exactly, including scheme and port), `AADSTS7000215` (wrong secret: you copied the Secret ID instead of the Value), `AADSTS700016` (client id or tenant mismatch).
