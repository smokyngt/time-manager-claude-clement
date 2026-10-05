# Field-level encryption

## What is encrypted and why

User-supplied personal text is encrypted at the application layer before it reaches PostgreSQL, so a leaked database dump, replica or backup does not expose it without the keys.

| Table   | Encrypted columns                              |
| ------- | ---------------------------------------------- |
| `users` | `email`, `first_name`, `last_name`, `phone_number` |
| `teams` | `name`, `description`                          |
| `clocks`| `note`                                         |

Values that must be looked up or kept unique use a keyed hash column instead (for example `email_hash`, computed with `Digest.email`). Hash columns never appear in API responses.

## Format

```
v1.<keyId>.<iv b64url>.<tag b64url>.<ciphertext b64url>
```

- Algorithm: AES-256-GCM, 12-byte random IV per value, 16-byte tag.
- Additional authenticated data: `time-manager:v1`.
- `keyId` selects the key used (current or previous), which makes rotation possible without downtime.
- Any tampering, wrong key or malformed value raises the registered error `crypto.decrypt.failed` (HTTP 500).

API: `Cipher.seal`, `Cipher.open`, `Cipher.rotate`, `Cipher.current`, and the `Cipher.nullable.*` variants. Hashing: `Digest.hash(value, purpose)` (HMAC-SHA256 hex, domain separated per purpose) and `Digest.email`.

## Configuration

| Variable                   | Meaning                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `ENCRYPTION_KEY`           | Current key, base64, exactly 32 bytes. Required in production.   |
| `ENCRYPTION_KEY_ID`        | Id of the current key (default `k1`, `[A-Za-z0-9_-]{1,32}`).     |
| `ENCRYPTION_KEYS_PREVIOUS` | Optional comma list `id:base64` of retired keys, still readable. |
| `HASH_KEY`                 | HMAC key, base64, at least 32 bytes. Required in production.     |

Outside production, missing keys fall back to deterministic development keys derived from a fixed label. These are public and must never protect real data. In production, missing or short keys fail `Keys.validate()` and the application refuses to start.

## Generating keys

```
openssl rand -base64 32
```

Generate separate values for `ENCRYPTION_KEY` and `HASH_KEY`.

## Rotation runbook

1. Generate a new key and pick a new id (for example `k2`).
2. Set `ENCRYPTION_KEYS_PREVIOUS="k1:<old key>"`, `ENCRYPTION_KEY=<new key>`, `ENCRYPTION_KEY_ID=k2`. Deploy. New writes use `k2`; old values stay readable.
3. Run `bun run db:rotate` (compiled: `bun dist/db/rotate.js`). It processes users, teams and clocks in batches of 500, each batch in one transaction, and re-seals only values whose key id is not current. It is idempotent and can be resumed after an interruption. It logs counts only.
4. Verify a second run reports `rotated 0` for every table.
5. Keep the old key in `ENCRYPTION_KEYS_PREVIOUS` until every backup you may restore without re-rotating is past retention, then remove it.

Rotating `HASH_KEY` is different: hashes cannot be re-derived from ciphertext without decrypting. Decrypt, recompute and update the hash columns in a dedicated migration.

## Backups

- Dumps contain only ciphertext. Store the keys (`ENCRYPTION_KEY`, every id in `ENCRYPTION_KEYS_PREVIOUS`, `HASH_KEY`) in a secret manager or vault separate from the dumps and their storage; a backup together with its keys defeats the encryption.
- Losing a key makes the values sealed with it permanently unrecoverable. Back keys up before the first production write and after each rotation.
- To restore an old dump, the key ids used in it must still be configured, as current or previous.

## Limitations

- No `ORDER BY`, `LIKE`, range or full-text search on encrypted columns; ciphertext is random per value.
- Equality lookups work only through hash columns (for example `email_hash`).
- Sorting and substring search must happen client-side after decryption, or be redesigned around dedicated hashed or derived columns.
- Encryption protects data at rest; the application still holds plaintext in memory and in API responses.
