import { createServer } from './server.ts';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const server = createServer({ token, trustProxy: process.env.TRUST_PROXY === '1' });

server.listen(port, host, () => {
  console.log(`gitwrapped listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  if (!token) {
    console.warn('No GITHUB_TOKEN set: only /api/demo/* works. Set GITHUB_TOKEN to enable real profiles.');
  }
});

function shutdown(): void {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
