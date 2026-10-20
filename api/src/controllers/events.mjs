import * as events from '../services/events.mjs';

export async function list(_req, res) {
  res.json(await events.list());
}
export async function detail(req, res) {
  res.status(200).json(await events.detail(req.validated.params.id));
}
export async function create(req, res) {
  const event = await events.create(req.validated.body);
  res.status(201).location('/api/events/' + event.id).json(event);
}
export async function update(req, res) {
  res.status(200).json(await events.update(req.validated.params.id, req.validated.body));
}
export async function remove(req, res) {
  await events.remove(req.validated.params.id);
  res.status(204).send();
}
