/**
 * Converts payload keys between the camelCase used by the SDK and the snake_case used on the wire.
 */
export class Payload {
  /**
   * Converts a snake_case wire value to camelCase, recursively.
   *
   * @route client.payload.deserialize
   * @param {unknown} value
   * @returns {unknown}
   */
  public static deserialize(value: unknown): unknown {
    return Payload.walk(value, 'camel');
  }

  /**
   * Converts a camelCase value to snake_case, recursively. Dates and arrays are preserved.
   *
   * @route client.payload.serialize
   * @param {unknown} value
   * @returns {unknown}
   */
  public static serialize(value: unknown): unknown {
    return Payload.walk(value, 'snake');
  }

  private static camel(key: string): string {
    return key.replace(/_+([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
  }

  private static plain(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const proto: unknown = Object.getPrototypeOf(value);

    return proto === Object.prototype || proto === null;
  }

  private static snake(key: string): string {
    return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  }

  private static walk(value: unknown, mode: 'camel' | 'snake'): unknown {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => Payload.walk(item, mode));
    }
    if (!Payload.plain(value)) {
      return value;
    }
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue;
      }
      output[mode === 'camel' ? Payload.camel(key) : Payload.snake(key)] = Payload.walk(item, mode);
    }

    return output;
  }
}
