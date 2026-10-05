import { build } from '@/app.js';
import { Config } from '@/config/index.js';

const problems = Config.validate();
if (problems.length > 0) {
  process.stderr.write(`invalid configuration: ${problems.join('; ')}\n`);
  process.exit(1);
}

const app = await build({
  logger: { level: Config.store.text('LOG_LEVEL', 'info') },
});

const stop = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

await app.listen({ host: '0.0.0.0', port: Config.store.number('PORT', 8000) });
