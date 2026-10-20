# Campus Events

Starter project for **Advanced Development** (Thomas More – International Experience Design, year 3).

A small but complete web app: students browse campus events and register for them.

- **api/** : REST API: Node.js, Express 5, Sequelize + SQLite, Zod
- **web/** : frontend: Vue 3, Vue Router, Vite

It works out of the box, and it has tests. It is also the kind of code you will meet in your first job:
the API now separates HTTP handling, business rules and database queries. Your job is to **clean it up, ship it to production, fix it and add the hard
parts**

## Quick start

You need **Node.js 22.12 or newer** (`node -v`) and Git.

```bash
git clone <your-fork-url>
cd campus-events
npm install        # installs api + web in one go
npm run dev        # starts both
```

Open **http://localhost:5173**. The API runs on http://localhost:3000/api.
The first start fills the database with demo events. `npm run seed` resets it.

Later parts need a few services. You never need them to run the tests.

| Service | Local | Setting in `api/.env` |
|---|---|---|
| RabbitMQ | `docker compose up -d rabbitmq` | `AMQP_URL` |
| Redis | `docker compose up -d redis` | `REDIS_URL` |
| Identity provider | a free Auth0 tenant | `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_CLIENT_ID` |

## Scripts (run from the root folder)

| Script | What it does |
|---|---|
| `npm run dev` | API + frontend with auto-reload |
| `npm test` | All tests: API (node:test + supertest) and frontend (Vitest) |
| `npm run lint` | ESLint for the whole project |
| `npm run check` | Lint + tests. **The pipeline runs exactly this. It must be green before you hand in.** |
| `npm run seed` | Reset the database to the demo data |
| `npm run build` | Production build of the frontend |

## How it fits together

```
browser ──► web (Vite, :5173) ──/api/*──► api (Express, :3000) ──► SQLite (api/data/events.sqlite)
```

In development Vite forwards every `/api/...` request to the API (see `web/vite.config.js`),
so the browser only talks to one address and you don't need CORS.

### api/

The API is split into layers. A request flows through **routes → controllers → services → repositories**.

```
api/src/app.mjs       assembles Express and middleware
api/src/server.mjs    starts the app and seeds an empty database
api/src/seed.mjs      resets the database with demo data
api/src/routes/       connects URLs, validation and controllers
api/src/controllers/ translates HTTP requests and responses
api/src/services/    business rules and application errors
api/src/repositories/ database queries through Sequelize
api/src/models/      Sequelize models and associations
api/src/db/          database connection and demo data
api/src/config/      environment settings and logging
api/src/validation/  request schemas
api/src/middleware/  validation, request logging and error responses
api/src/errors/      shared AppError type
```

For example, registering for an event enters `routes/index.mjs`, passes validation,
then calls `controllers/registrations.mjs` → `services/registrations.mjs` →
`repositories/registrations.mjs`. The service checks the event and registration rules;
the controller returns the HTTP response. Services do not import Express or Sequelize.
Only `config/env.mjs` reads environment variables.

Progress: configuration/database extraction and API layer separation are complete.
`npm run check` passes all 20 API tests and 10 frontend tests. Existing integration
tests are unchanged. Email delivery and caching are future steps.

Known starter behaviour preserved for this refactor: the capacity check uses `>`
instead of `>=`, so one extra registration is accepted. Correcting that boundary
and handling concurrent registrations require a separate behaviour change with tests.

The integration tests in `api/tests/integration` only talk HTTP. They pass before your refactoring,
and they must still pass after it, without changing them.

| Method | URL | |
|---|---|---|
| GET | `/api/health` | Health check |
| GET / POST | `/api/events` | List / create |
| GET / PATCH / DELETE | `/api/events/:id` | One event (incl. `registered`, `spotsLeft`) |
| GET / POST | `/api/events/:id/registrations` | List / register `{ name, email }` |
| GET | `/api/stats` | Occupancy per event |

Errors always have this shape: `{ "error": { "code", "message", "details?" } }`.

### web/

```
api/          client.js (fetch + ApiError) and events.js (one function per endpoint)
views/        one component per page, registered in router.js
components/   reusable pieces: EventCard, SeatMeter, RegistrationForm, ErrorMessage
styles.css    design tokens at the top, change those first
```
