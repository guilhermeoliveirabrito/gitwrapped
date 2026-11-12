#!/usr/bin/env node
import { run } from './cli.ts';

// When the reader closes the pipe early (for example `gitwrapped ... | head`), exit quietly
// instead of crashing with an EPIPE stack trace.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
}

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
  env: process.env,
  cwd: process.cwd(),
});
