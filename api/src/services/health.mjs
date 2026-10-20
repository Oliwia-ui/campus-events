import { authenticate } from '../repositories/health.mjs';

export async function check() {
  await authenticate();
  return { status: 'ok' };
}
