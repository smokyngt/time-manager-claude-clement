export type Loose<T> = {
  [Key in keyof T]?: T[Key] extends (...args: never[]) => unknown
    ? unknown
    : Loose<T[Key]> | T[Key];
} & Record<string, unknown>;
