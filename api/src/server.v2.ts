import '@/lib/telemetry/instrument.js';

import { count, isNull } from 'drizzle-orm';

import { build } from '@/app.v2.js';
import { Config } from '@/config/index.js';
import { db, sql } from '@/db/client.js';
import { clocks } from '@/db/schema/clock.js';
import { Lifecycle } from '@/lib/lifecycle/index.js';
import { Metrics } from '@/lib/telemetry/metrics.js';

const problems = Config.validate();
if (problems.length > 0) {
  process.stderr.write(`invalid configuration: ${problems.join('; ')}\n`);
  process.exit(1);
}

Metrics.bind({
  openClocks: async () => {
    const [row] = await db
      .select({ total: count() })
      .from(clocks)
      .where(isNull(clocks.clocked_out_at));

    return row?.total ?? 0;
  },
  poolMax: Config.store.number('DATABASE_POOL_MAX', 10),
});

const app = await build();
Lifecycle.shutdown({ app, sql });

await app.listen({ host: '0.0.0.0', port: Config.store.number('PORT', 8000) });
