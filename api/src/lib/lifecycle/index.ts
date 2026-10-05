import { Tracing } from '@/lib/telemetry/tracing.js';

export interface Closable {
  end: (options?: { timeout?: number }) => Promise<void>;
}

export type Runtime = Pick<NodeJS.Process, 'exit' | 'on'>;

export interface ServerLike {
  close: () => Promise<unknown>;
  log: {
    error: (payload: object, message: string) => void;
    fatal: (payload: object, message: string) => void;
    info: (payload: object, message: string) => void;
  };
}

export class Lifecycle {
  public static readonly drain = 10_000;

  /**
   * @route lifecycle.fatal
   * @param {ServerLike} app
   * @param {Runtime} runtime
   * @param {string} event
   * @param {unknown} reason
   * @returns {void}
   */
  public static fatal(app: ServerLike, runtime: Runtime, event: string, reason: unknown): void {
    app.log.fatal({ err: reason, event }, 'process crashed');
    runtime.exit(1);
  }

  /**
   * @route lifecycle.shutdown
   * @param {ServerLike} app
   * @param {Closable} sql
   * @param {Runtime} runtime
   * @returns {void}
   */
  public static shutdown(app: ServerLike, sql: Closable, runtime: Runtime = process): void {
    let stopping = false;
    const handle = (signal: string): void => {
      if (stopping) return;
      stopping = true;
      void Lifecycle.stop(app, sql, signal).then((code) => runtime.exit(code));
    };
    runtime.on('SIGTERM', () => {
      handle('SIGTERM');
    });
    runtime.on('SIGINT', () => {
      handle('SIGINT');
    });
    runtime.on('unhandledRejection', (reason: unknown) => {
      Lifecycle.fatal(app, runtime, 'unhandledRejection', reason);
    });
    runtime.on('uncaughtException', (error: unknown) => {
      Lifecycle.fatal(app, runtime, 'uncaughtException', error);
    });
  }

  /**
   * @route lifecycle.stop
   * @param {ServerLike} app
   * @param {Closable} sql
   * @param {string} signal
   * @returns {Promise<number>}
   */
  public static async stop(app: ServerLike, sql: Closable, signal: string): Promise<number> {
    app.log.info({ signal }, 'shutdown started');
    let code = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        resolve('timeout');
      }, Lifecycle.drain);
    });
    try {
      const outcome = await Promise.race([app.close().then(() => 'closed' as const), expired]);
      if (outcome === 'timeout') {
        app.log.error({ signal }, 'server close timed out');
        code = 1;
      }
    } catch (error) {
      app.log.error({ err: error }, 'server close failed');
      code = 1;
    } finally {
      clearTimeout(timer);
    }
    try {
      await sql.end({ timeout: 5 });
    } catch (error) {
      app.log.error({ err: error }, 'database close failed');
      code = 1;
    }
    try {
      await Tracing.stop();
    } catch (error) {
      app.log.error({ err: error }, 'tracing shutdown failed');
    }
    app.log.info({ code }, 'shutdown complete');
    return code;
  }
}
