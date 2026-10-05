export interface FakeCall {
  args: unknown[];
  method: string;
  op: string;
}

export class FakeDb {
  public readonly calls: FakeCall[] = [];
  private readonly queue: unknown[] = [];

  public arg(op: string, method: string): unknown {
    return this.calls.find((call) => call.op === op && call.method === method)?.args[0];
  }

  public delete(): FakeQuery {
    return new FakeQuery(this, 'delete');
  }

  public enqueue(...results: unknown[]): this {
    this.queue.push(...results);
    return this;
  }

  public insert(): FakeQuery {
    return new FakeQuery(this, 'insert');
  }

  public next(): unknown {
    return this.queue.length === 0 ? [] : this.queue.shift();
  }

  public reset(): void {
    this.calls.length = 0;
    this.queue.length = 0;
  }

  public select(): FakeQuery {
    return new FakeQuery(this, 'select');
  }

  public update(): FakeQuery {
    return new FakeQuery(this, 'update');
  }
}

export class FakeQuery implements PromiseLike<unknown> {
  public constructor(
    private readonly owner: FakeDb,
    private readonly op: string,
  ) {}

  public from(...args: unknown[]): this {
    return this.record('from', args);
  }

  public limit(...args: unknown[]): this {
    return this.record('limit', args);
  }

  public orderBy(...args: unknown[]): this {
    return this.record('orderBy', args);
  }

  public returning(...args: unknown[]): this {
    return this.record('returning', args);
  }

  public set(...args: unknown[]): this {
    return this.record('set', args);
  }

  public then<Result1 = unknown, Result2 = never>(
    onfulfilled?: ((value: unknown) => Promise<Result1> | Result1) | null,
    onrejected?: ((reason: unknown) => Promise<Result2> | Result2) | null,
  ): Promise<Result1 | Result2> {
    const next = this.owner.next();
    const settled = next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    return settled.then(onfulfilled, onrejected);
  }

  public values(...args: unknown[]): this {
    return this.record('values', args);
  }

  public where(...args: unknown[]): this {
    return this.record('where', args);
  }

  private record(method: string, args: unknown[]): this {
    this.owner.calls.push({ args, method, op: this.op });
    return this;
  }
}
