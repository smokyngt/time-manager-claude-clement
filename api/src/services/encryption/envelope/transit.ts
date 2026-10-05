import { Buffer } from 'node:buffer';

export type TransitClient = {
  read: (path: string) => Promise<TransitReply | undefined>;
  write: (path: string, data: Record<string, unknown>) => Promise<TransitReply | undefined>;
};

export type TransitReply = { data?: Record<string, unknown> };

const KEY_TYPE = 'aes256-gcm96';
const NOT_FOUND = 404;

const missing = (error: unknown): boolean => {
  const shape = error as {
    response?: { statusCode?: number };
    status?: number;
    statusCode?: number;
  } | null;
  if (shape === null || typeof shape !== 'object') return false;

  return (
    shape.status === NOT_FOUND ||
    shape.statusCode === NOT_FOUND ||
    shape.response?.statusCode === NOT_FOUND
  );
};

const field = (reply: TransitReply | undefined, name: string): string => {
  const value = reply?.data?.[name];
  if (typeof value !== 'string' || value === '') throw new Error(`transit reply has no ${name}`);

  return value;
};

/**
 * @route services.encryption.envelope.transit.ensure
 * @param {TransitClient} client
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const ensureTransitKey = async (client: TransitClient, name: string): Promise<boolean> => {
  try {
    const reply = await client.read(`transit/keys/${name}`);
    if (reply?.data !== undefined) return false;
  } catch (error) {
    if (!missing(error)) throw error;
  }
  await client.write(`transit/keys/${name}`, {
    deletion_allowed: false,
    exportable: false,
    type: KEY_TYPE,
  });

  return true;
};

/**
 * @route services.encryption.envelope.transit.wrap
 * @param {TransitClient} client
 * @param {string} name
 * @param {Buffer} key
 * @returns {Promise<string>}
 */
export const wrapKey = async (client: TransitClient, name: string, key: Buffer): Promise<string> =>
  field(
    await client.write(`transit/encrypt/${name}`, { plaintext: key.toString('base64') }),
    'ciphertext',
  );

/**
 * @route services.encryption.envelope.transit.unwrap
 * @param {TransitClient} client
 * @param {string} name
 * @param {string} wrapped
 * @returns {Promise<Buffer>}
 */
export const unwrapKey = async (
  client: TransitClient,
  name: string,
  wrapped: string,
): Promise<Buffer> =>
  Buffer.from(
    field(await client.write(`transit/decrypt/${name}`, { ciphertext: wrapped }), 'plaintext'),
    'base64',
  );

/**
 * @route services.encryption.envelope.transit.rewrap
 * @param {TransitClient} client
 * @param {string} name
 * @param {string} wrapped
 * @returns {Promise<string>}
 */
export const rewrapKey = async (
  client: TransitClient,
  name: string,
  wrapped: string,
): Promise<string> =>
  field(await client.write(`transit/rewrap/${name}`, { ciphertext: wrapped }), 'ciphertext');

/**
 * @route services.encryption.envelope.transit.rotate
 * @param {TransitClient} client
 * @param {string} name
 * @returns {Promise<void>}
 */
export const rotateTransitKey = async (client: TransitClient, name: string): Promise<void> => {
  await client.write(`transit/keys/${name}/rotate`, {});
};
