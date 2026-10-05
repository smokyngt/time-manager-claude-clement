const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const TAB = 9;
const LINE_FEED = 10;
const SPACE = 32;
const DELETE = 127;

type Frame = { level: number; value: unknown };

export class Sanitizer {
  /**
   * @route sanitizer.body
   * @param {unknown} value
   * @returns {unknown}
   */
  public static body(value: unknown): unknown {
    if (typeof value === 'string') return Sanitizer.text(value);
    if (Array.isArray(value)) return value.map((item: unknown) => Sanitizer.body(item));
    if (typeof value === 'object' && value !== null) {
      const clean: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        if (!FORBIDDEN_KEYS.has(key)) clean[key] = Sanitizer.body(item);
      }

      return clean;
    }

    return value;
  }

  /**
   * @route sanitizer.depth
   * @param {unknown} value
   * @returns {number}
   */
  public static depth(value: unknown): number {
    let deepest = 0;
    const stack: Frame[] = [{ level: 0, value }];
    for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
      if (typeof frame.value === 'object' && frame.value !== null) {
        const level = frame.level + 1;
        deepest = Math.max(deepest, level);
        const children: unknown[] = Array.isArray(frame.value)
          ? frame.value
          : Object.values(frame.value);
        for (const child of children) stack.push({ level, value: child });
      }
    }

    return deepest;
  }

  private static text(value: string): string {
    let clean = '';
    for (const char of value) {
      const code = char.codePointAt(0) ?? 0;
      const control = (code < SPACE && code !== TAB && code !== LINE_FEED) || code === DELETE;
      if (!control) clean += char;
    }

    return clean.trim();
  }
}
