// Shared .env loader for the scripts that talk to live systems. Without it a
// live run silently sends no auth header and every request comes back 403,
// which reads like a broken kiosk rather than a missing env file.
import { resolve } from 'node:path';

export const projectRoot = resolve(import.meta.dirname, '..');

try {
  process.loadEnvFile(resolve(projectRoot, '.env'));
} catch {
  // .env is optional; the shell may already carry the values.
}
