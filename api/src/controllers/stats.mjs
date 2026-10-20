import * as stats from '../services/stats.mjs';

export async function list(_req, res) {
  res.json(await stats.list());
}
