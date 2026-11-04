# Assignment: Campus Events

| | |
|---|---|
| GitHub | https://github.com/Oliwia-ui/campus-events |
| Live | https://campus-events-aub6.onrender.com |

## 1. Clean up and split logic to best practices

* **Layers.** A request goes through routes → controllers → services → repositories. Routes only wire
  middleware, services hold the rules and never import Express or Sequelize, and only repositories
  touch models. `config/env.mjs` is the only file that reads environment variables.
* **Middleware.**
  * `validate` checks input with Zod.
  * `requireJson` returns 415 for a body that isn't JSON.
  * `cached` caches GET responses.
  * `frontend` serves the Vue app.
  * `errors` turns every error into `{ error: { code, message, details } }`.
* **Bug fixed: capacity.** The starter compared `>` instead of `>=`, so one person too many got in.
  Worse, 10 parallel requests on a 3-seat event all succeeded. Now there is one transaction per
  registration, a queue so one process handles one registration at a time, and `SELECT … FOR UPDATE`
  on Postgres for several servers.
  Test: `tests/integration/capacity.test.mjs`.
* **Errors from the request table in class.** See the table in the README.
  Test: `tests/integration/requestErrors.test.mjs`.

## 2. Mail after registration, async, and safe when the mail provider is down

* **Transactional outbox.** The registration and an `OutboxMessage` row are saved in the same
  transaction. The HTTP response doesn't wait for any mail server.
* **The relay** (`messaging/outboxRelay.mjs`) checks for pending rows every 3 s. After a failure it waits
  twice as long each time (3 s, 6 s, 12 s … max 15 min), so an outage of hours is survived. It marks a row as done
  only after delivery succeeded, so a broken provider means "later", never "lost".
* **RabbitMQ** (`messaging/rabbit.mjs`). The relay publishes on a confirm channel, so the broker
  confirms it stored the message. The consumer (`messaging/mailConsumer.mjs`) sends with nodemailer
  and acks only after the mail is sent. If sending fails, it waits 10 s and requeues.
* **One connection** with automatic reconnect (amqplib `recovery`), because free brokers allow only
  a few connections.
* **Tested with a real SMTP server:** stopped it, registered (201 in 14 ms), restarted it, and the
  mail arrived.
  Test: `tests/mail.test.mjs`.

## 3. Cache GET endpoints and stay correct after changes

* **Cache-aside middleware** on the 4 GET endpoints. Data comes from Redis, or from memory without
  `REDIS_URL`. The `X-Cache` header shows HIT or MISS.
* **Invalidation.** Every write deletes the keys it makes outdated, after the commit and before the
  response. So the next GET always shows the new `spotsLeft`.
* **Safety nets.** The TTL is 60 s, and when Redis is down the API falls back to the database.
  Tested by killing Redis.
  Test: `tests/integration/cache.test.mjs`.

## 4. Online

* **One Docker image on Render.** It builds the Vue app and Express serves it. Data lives in Neon
  Postgres, the cache in Render Key Value (Redis), the queue in CloudAMQP, and mail goes through
  Ethereal SMTP.
* Steps are in the README under "Deploy to Render".
* What runs online right now:

  | Part | Online | Without its setting |
  |---|---|---|
  | Cache | Render Key Value (Redis), `REDIS_URL` | in-memory cache |
  | Database | `DATABASE_URL` (Neon) if set | SQLite, reset when Render restarts |
  | Queue | `AMQP_URL` (CloudAMQP) if set | the relay sends the mail itself |
  | Mail | `SMTP_*` (Ethereal) if set | mail is built and logged, not sent |

* The free Render instance sleeps after 15 minutes; the first visit then takes about a minute.
* Render's free plan blocks outgoing mail on ports 25, 465 and 587
  ([Render changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)).
  With Ethereal on port 587 the live log shows exactly the requirement: the registration is saved (201)
  and the outbox keeps retrying. A provider on port 2525 (Mailtrap, Brevo) gets the mail through.

## Known limitations

* **Cache race.** A slow GET that read the database just before a write can store the old
  response just after the write cleared it. That stale entry lives at most 60 s (the TTL).
* **Capacity queue.** The in-process queue handles one registration at a time per server.
  That is plenty here; with many servers the Postgres row lock does the real work.

## Stack Overflow

| Link | Used for |
|---|---|
| [How to lock table in Sequelize, wait until another request is complete](https://stackoverflow.com/questions/48297419) | Two requests reading "1 seat left" at the same time. The answer: run the read in a transaction with `lock`, which becomes `SELECT … FOR UPDATE` and makes the second request wait. Used in `repositories/events.mjs` → `findByIdForUpdate`. |
| [How to set a redelivery time for RabbitMQ](https://stackoverflow.com/questions/73344478) | After a `nack` with requeue, RabbitMQ redelivers immediately, so a dead mail server would cause a tight retry loop. Their solution is a TTL wait queue; we chose the simpler version: wait 10 s in the consumer before requeueing (`messaging/mailConsumer.mjs`). |
| [vue-router returns 404 when revisiting the URL](https://stackoverflow.com/questions/36399319) | In history mode a refresh on `/events/1` asks the server for that path. The server has to answer with `index.html` so Vue Router can show the page. Used in `middleware/frontend.mjs`. |
| [Can't get POST data using Node.js/Express and Postman](https://stackoverflow.com/questions/41955103) | `req.body` stays empty when the Content-Type doesn't match the parser. That is why a request without `Content-Type: application/json` now gets a clear 415 instead of a confusing validation error (`middleware/requireJson.mjs`). |

Background reading for the outbox: [microservices.io – Transactional outbox](https://microservices.io/patterns/data/transactional-outbox).

## Demo for class

1. **Capacity.** Run the 10 parallel requests from `capacity.test.mjs`: 3 succeed and 7 get "Event is full".
   On Postgres with two servers and 20 requests on 5 seats, exactly 5 succeed. Without
   `FOR UPDATE` it was 6.
2. **Mail.** Register on the live site, then open the `previewUrl` from the Render log.
3. **Cache.**
   * `curl -i …/api/events/1` twice: MISS, then HIT.
   * Register, then fetch again: MISS, with the new `spotsLeft`.

## Questions you might get

* **Why not send the mail directly in the request?** It is slow (2 s in the lab), and if the mail
  server is down the request would fail or the mail would be lost. With the outbox, both are saved in
  one transaction and the sending happens later.
* **Why the outbox if you have RabbitMQ?** Publishing to RabbitMQ after the commit can fail (broker
  down, crash). The outbox row survives that; the relay publishes it later.
* **Can a mail be sent twice?** Yes, in a rare crash between "sent" and "marked". That is
  at-least-once delivery, the normal trade-off: a duplicate is better than a missing mail.
* **Why delete cache keys instead of updating them?** Deleting is simple and always correct. The next
  GET rebuilds the entry from the database.
* **Why the in-memory queue AND the database lock?** The queue keeps it simple within one process
  (and SQLite has no row locks). The lock protects you when there are several servers.
