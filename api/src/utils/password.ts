export class Password {
  private static dummy: Promise<string> | undefined;

  /**
   * @route password.hash
   * @param {string} plain
   * @returns {Promise<string>}
   */
  public static async hash(plain: string): Promise<string> {
    return Bun.password.hash(plain, { algorithm: 'argon2id' });
  }

  /**
   * @route password.verify
   * @param {string} plain
   * @param {null | string} hash
   * @returns {Promise<boolean>}
   */
  public static async verify(plain: string, hash: null | string): Promise<boolean> {
    Password.dummy ??= Bun.password.hash('time-manager-dummy-password', { algorithm: 'argon2id' });
    const target = hash ?? (await Password.dummy);
    const valid = await Bun.password.verify(plain, target);
    return hash !== null && valid;
  }
}
