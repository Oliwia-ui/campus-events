// MCP (Model Context Protocol) server: lets an AI assistant use Campus Events through "tools".
// MCP is JSON-RPC 2.0. We only need the small part an assistant uses to call tools:
// initialize → tools/list → tools/call. Written by hand (no SDK) so every line is visible.
import * as events from './events.mjs';
import * as registrations from './registrations.mjs';
import { AppError } from '../errors/AppError.mjs';
import { idSchema, registrationSchema } from '../validation/schemas.mjs';

const SERVER_INFO = { name: 'campus-events', version: '1.0.0' };
// Newest first. We answer with the client's version when we know it, otherwise our newest.
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

// Standard JSON-RPC error codes.
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INVALID_REQUEST = -32600;

const toEventSummary = (event) => {
  const { id, title, description, location, startsAt, capacity } = event.toJSON();
  return { id, title, description, location, startsAt, capacity };
};

async function listEvents(isWanted) {
  const all = await events.list();
  return all.filter((event) => isWanted(new Date(event.startsAt))).map(toEventSummary);
}

// The descriptions are read by the AI model: they tell it when and how to use each tool.
const tools = {
  list_upcoming_events: {
    description: 'List all campus events that have not started yet, soonest first.',
    inputSchema: { type: 'object', properties: {} },
    run: () => listEvents((startsAt) => startsAt >= new Date())
  },
  list_past_events: {
    description: 'List all campus events that already took place, oldest first.',
    inputSchema: { type: 'object', properties: {} },
    run: () => listEvents((startsAt) => startsAt < new Date())
  },
  register_for_event: {
    description: 'Register one person for an event. Find the eventId with list_upcoming_events first. ' +
      'Ask the user for the name and email if they did not give them.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'integer', description: 'Id of the event' },
        name: { type: 'string', description: 'Full name of the person to register' },
        email: { type: 'string', description: 'Email address; the confirmation mail goes here' }
      },
      required: ['eventId', 'name', 'email']
    },
    run: async (args) => {
      // Same Zod schemas as the REST API, so both entrances follow the same rules.
      const { id } = parse(idSchema, { id: args.eventId });
      const person = parse(registrationSchema, { name: args.name, email: args.email });
      const registration = await registrations.create(id, person);
      return { registered: true, registrationId: registration.id, eventId: id, name: registration.name };
    }
  }
};

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const textContent = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });

function initialize(params = {}) {
  const protocolVersion = PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0];
  return { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO };
}

const listTools = () => ({
  tools: Object.entries(tools).map(([name, { description, inputSchema }]) => ({ name, description, inputSchema }))
});

async function callTool(id, params) {
  const { name, arguments: args = {} } = params ?? {};
  if (!Object.hasOwn(tools, name)) return rpcError(id, INVALID_PARAMS, `Unknown tool: ${name}`);
  try {
    return rpcResult(id, textContent(await tools[name].run(args)));
  } catch (err) {
    // Expected problems (event full, unknown event, bad email) go back to the model as a tool
    // result with isError, so it can explain them to the user. Real bugs still reach the error handler.
    if (!(err instanceof AppError)) throw err;
    return rpcResult(id, { ...textContent({ error: err.message }), isError: true });
  }
}

// Every method an MCP client may call, mapped to the function that answers it.
const methods = {
  initialize: (id, params) => rpcResult(id, initialize(params)),
  ping: (id) => rpcResult(id, {}),
  'tools/list': (id) => rpcResult(id, listTools()),
  'tools/call': callTool
};

const isRequest = (message) => message?.jsonrpc === '2.0' && typeof message.method === 'string';

// Handles one JSON-RPC message. Returns the response, or null for a notification (no id),
// which by JSON-RPC rules never gets an answer.
export async function handle(message) {
  if (!isRequest(message)) return rpcError(message?.id ?? null, INVALID_REQUEST, 'Expected one JSON-RPC 2.0 request');
  const { id, method, params } = message;
  if (id === undefined) return null;
  // Object.hasOwn: a method called "toString" must not reach Object.prototype.
  if (!Object.hasOwn(methods, method)) return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  return methods[method](id, params);
}
