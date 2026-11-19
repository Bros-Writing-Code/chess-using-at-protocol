// Serves the built site and runs pa11y-ci against it. Run `npm run build` first.
// The server and pa11y share this process, so pa11y starts only once the server is
// listening.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { preview } from 'vite';

// .pa11yci.cjs expects this port. strictPort fails fast instead of moving to a free port.
const server = await preview({ preview: { port: 4173, strictPort: true } });

const pa11yCi = createRequire(import.meta.url).resolve('pa11y-ci/bin/pa11y-ci.js');
const child = spawn(process.execPath, [pa11yCi], { stdio: 'inherit' });
const exitCode = await new Promise((resolve) => child.on('close', resolve));

await server.close();
process.exitCode = exitCode;
