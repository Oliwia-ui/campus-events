import { cache } from '../cache/index.mjs';

// Cache-aside for GET routes: answer from the cache when we can, otherwise let the controller
// answer and remember its response. Only 200 responses are stored: a 404 for an event that
// is created a second later must not stick. X-Cache shows HIT or MISS, handy when testing.
export const cached = (keyFor) => async (req, res, next) => {
  const key = keyFor(req);
  const hit = await cache.get(key);
  if (hit !== undefined) {
    res.set('X-Cache', 'HIT');
    return res.json(hit);
  }

  res.set('X-Cache', 'MISS');
  const send = res.json.bind(res);
  res.json = (body) => {
    // JSON round-trip turns Sequelize objects into the plain data the client receives.
    if (res.statusCode === 200) cache.set(key, JSON.parse(JSON.stringify(body)));
    return send(body);
  };
  next();
};
