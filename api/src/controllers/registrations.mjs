import * as registrations from '../services/registrations.mjs';

export async function list(req, res) {
  res.json(await registrations.list(req.validated.params.id));
}
export async function create(req, res) {
  res.status(201).json(await registrations.create(req.validated.params.id, req.validated.body));
}
