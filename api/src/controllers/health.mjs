import * as health from '../services/health.mjs';

export async function check(_req, res) {
  res.json(await health.check());
}
