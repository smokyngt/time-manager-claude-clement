import { count, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { Config } from '@/config/index.js';
import { Env } from '@/config/env.js';
import { vaultConfig } from '@/config/vault/index.js';
import { initialize } from '@/config/vault/initialize.js';
import { db, sql } from '@/db/client.js';
import { clocks } from '@/db/schema/index.js';
import { Lifecycle } from '@/lib/lifecycle/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';
import { Tracing } from '@/lib/telemetry/tracing.js';
import { Envelope } from '@/services/encryption/envelope/index.js';

import type { Server } from 'node:https';

await initialize();

const problems = Config.validate();
if (problems.length > 0) {
  process.stderr.write(`invalid configuration: ${problems.join('; ')}\n`);
  process.exit(1);
}

Tracing.start();

Metrics.bind({
  openClocks: async () => {
    const [row] = await db
      .select({ total: count() })
      .from(clocks)
      .where(isNull(clocks.clocked_out_at));

    return row?.total ?? 0;
  },
  poolMax: vaultConfig.store.number('DATABASE_POOL_MAX', 10),
});

await Envelope.bootstrap();

const { build } = await import('@/app.js');
const secure = vaultConfig.pki.enabled();
const app = await build(secure ? { https: { ...vaultConfig.pki.creds(), minVersion: 'TLSv1.2' } } : {});
if (secure) {
  vaultConfig.pki.onRenew((next) => {
    (app.server as Server).setSecureContext(next);
    app.log.info('listener certificate renewed');
  });
}
Lifecycle.shutdown({ app, sql });

await app.listen({ host: '0.0.0.0', port: Env.int('PORT', 8000) });
