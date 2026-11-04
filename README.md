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
api/src/middleware/  validation, JSON check, caching, frontend, logging and error responses
api/src/errors/      shared AppError type
api/src/cache/       Redis cache (or in-memory without REDIS_URL) and the cache keys
api/src/mail/        nodemailer transport and the confirmation mail text
api/src/messaging/   outbox relay, RabbitMQ connection and the mail consumer
api/src/utils/       small helpers (serial queue)
```

For example, registering for an event enters `routes/index.mjs`, passes validation,
then calls `controllers/registrations.mjs` → `services/registrations.mjs` →
`repositories/registrations.mjs`. The service checks the event and registration rules;
the controller returns the HTTP response. Services do not import Express or Sequelize.
Only `config/env.mjs` reads environment variables.

`npm run check` passes 55 API tests and 10 frontend tests. The original integration
tests are unchanged; new behaviour has its own test files.

#### Registrations and capacity

A registration is checked and saved in one database transaction, one at a time per process
(`utils/serialQueue.mjs`). On Postgres the event row is also locked (`SELECT … FOR UPDATE`),
so even two API servers can't sell the same last seat. A full event answers `409 Event is full`.

#### Confirmation mail (asynchronous, survives a broken mail server)

```
POST /registrations ──► one transaction: Registration + OutboxMessage ──► 201 (no mail server involved)
                                                │
          outbox relay (every few seconds) ◄────┘   marks the row processed only after success
                 │
     AMQP_URL set? ──yes──► RabbitMQ exchange "campus-events" ──► queue campus-events.mail ──► mail consumer ──► SMTP
                 └─no───► sends the mail itself ───────────────────────────────────────────────────────────► SMTP
```

* The registration and the "send this mail" row are saved together or not at all.
* Mail server or RabbitMQ down: the row stays pending (`attempts`, `lastError`) and is retried with
  exponential backoff (3 s, 6 s, 12 s … at most every 15 min), for about a day.
* The consumer acks only after the mail is sent; on failure it waits 10 s and requeues.
* Delivery is at-least-once: in a rare crash a mail can be sent twice, never lost.
* Without `SMTP_HOST` the mail is built and logged, not sent (development).

#### Caching

The four GET endpoints (`/events`, `/events/:id`, `/events/:id/registrations`, `/stats`) are cached
by `middleware/cached.mjs`, in Redis when `REDIS_URL` is set and in memory otherwise.
The `X-Cache` response header shows `HIT` or `MISS`. After every write the service deletes
exactly the keys that became outdated (`cache/index.mjs` → `cacheKeys`), so the next GET is fresh.
Entries also expire after 60 s as a safety net. If Redis is down the API reads from the database.

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

| Situation | Status | `error.code` |
|---|---|---|
| Unknown event id | 404 | `NOT_FOUND` |
| Id that is not a positive whole number (`/events/abc`) | 400 | `VALIDATION_ERROR` |
| Broken JSON body | 400 | `INVALID_JSON` |
| Body without `Content-Type: application/json` | 415 | `UNSUPPORTED_MEDIA_TYPE` |
| Same email twice, or event full | 409 | `CONFLICT` |
| Unknown route under `/api` | 404 | `NOT_FOUND` |

### web/

```
api/          client.js (fetch + ApiError) and events.js (one function per endpoint)
views/        one component per page, registered in router.js
components/   reusable pieces: EventCard, SeatMeter, RegistrationForm, ErrorMessage
styles.css    design tokens at the top, change those first
```

## Deploy to Render (Docker: API + website on one URL)

The Docker image builds the Vue app and Express serves it, so one Render URL is the whole site.
Pages like `/events/1` work after a refresh; `/api/...` is the API.

### 1. Create the services (free plans)

| Service | Where | Copy this |
|---|---|---|
| Postgres | [neon.tech](https://neon.tech) → new project | connection string → `DATABASE_URL` |
| RabbitMQ | [cloudamqp.com](https://www.cloudamqp.com) → free plan | AMQP URL (`amqps://…`) → `AMQP_URL` |
| Redis | Render → New → **Key Value** (same region as the web service) | Internal URL (`redis://…`) → `REDIS_URL` |
| Mail | [mailtrap.io](https://mailtrap.io) → Sandboxes → your sandbox → SMTP | username, password → `SMTP_USER`, `SMTP_PASS` |

> Render's **free** web services block outgoing mail on ports 25, 465 and 587, so use port **2525**.
> Locally, [ethereal.email](https://ethereal.email) on port 587 works too.

### 2. Create the web service

1. Render → New → **Web Service** from this repository. **Language: Docker**, Dockerfile `./Dockerfile`, Free instance.
2. Environment variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
REDIS_URL=redis://red-...:6379
AMQP_URL=amqps://...cloudamqp.com/...
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=Campus Events <no-reply@campus-events.app>
```

3. Health check path `/api/health`, then deploy.

Each of the four services is optional: without `DATABASE_URL` the app uses SQLite (reset on every
restart on Render), without `REDIS_URL` it caches in memory, without `AMQP_URL` the relay sends the
mail itself, without `SMTP_HOST` mails are only logged.

### 3. Check it works

* `https://YOUR-SERVICE.onrender.com/` shows the events.
* Logs show `Redis connected`, `RabbitMQ connected` and `messaging started`.
* Register for an event: the log shows `mail sent`, and the mail appears in your Mailtrap sandbox.
* `curl -i https://YOUR-SERVICE.onrender.com/api/events` twice: the second has `X-Cache: HIT`.

The free web service sleeps after 15 minutes without visitors; the first request then takes about a minute.

Local checks: `npm run check`. To test the image with Docker:

```bash
docker build -t campus-events .
docker run --rm -p 3000:3000 campus-events
```
