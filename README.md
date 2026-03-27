## Seed Credentials

| Email | Password | Role | Zones |
|-------|----------|------|-------|
| supervisor@gridwatch.test | GridWatch2026! | supervisor | All zones |
| operator_a@gridwatch.test | GridWatch2026! | operator | Zone A (Northeast Grid) |
| operator_b@gridwatch.test | GridWatch2026! | operator | Zones B + C |

Seeded scenarios include 50 threshold breach sensors, 20 silent sensor candidates, 10 active suppressions, 5 escalatable critical alerts (opened >5 min ago), 3 acknowledged alerts, and 2 resolved alerts.


# GridWatch — Real-Time Infrastructure Anomaly Detection

A full-stack platform that ingests sensor telemetry, detects anomalies in real-time, manages alerts through a structured state machine, and streams status updates to operators via SSE.

---

## Quick Start

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and JWT_SECRET to non-default values

docker-compose up --build -d
# Wait ~30-60s for all services to become healthy

# Login: http://localhost
# supervisor@gridwatch.test / GridWatch2026!   (sees all 1050 sensors)
# operator_a@gridwatch.test / GridWatch2026!   (Zone A only, 400 sensors)
# operator_b@gridwatch.test / GridWatch2026!   (Zones B+C, 650 sensors)
```

That's it. The seed container runs automatically and populates the database with 1050 sensors, 604,800 readings, and demonstration scenarios.

---

## Architecture
Here is the flow chart diagram of complete process.

<img width="800" height="646" alt="flow" src="https://github.com/user-attachments/assets/8c47aff1-440e-4542-817e-053fe6b85412" />

```
Browser
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  Nginx (port 80)                                     │
│  - /api/* → proxy_pass backend:3000 (SSE-safe)      │
│  - /*      → React SPA (try_files)                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│  Express 5 Backend (port 3000)                        │
│                                                       │
│  Routes           Workers                            │
│  POST /ingest ──► anomalyWorker (BLPOP)              │
│  GET  /sensors     patternAbsenceWorker (30s timer)  │
│  GET  /alerts      escalationWorker (15s timer)      │
│  PATCH /alerts/:id                                    │
│  GET  /events ──► SSE stream (EventSource)           │
│                        │                             │
│                        ▼                             │
│              Redis pub/sub (PSUBSCRIBE)              │
└──────────┬───────────────────────────────────────────┘
           │                           │
           ▼                           ▼
   PostgreSQL 16               Redis 7
   (source of truth)           - pub/sub events
   - all state                 - anomaly queue (LPUSH/BLPOP)
   - audit log                 - history count cache (30s TTL)
```

**Three Redis clients** are maintained to avoid blocking:
- `redis` — general operations (publish, cache get/set)
- `redisSub` — exclusive PSUBSCRIBE (must not issue other commands)
- `redisQueue` — exclusive BLPOP for the anomaly queue (long-poll blocks the connection)

---

## Setup

### Environment variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password (also used to build `DATABASE_URL` inside Docker) |
| `JWT_SECRET` | HMAC-SHA256 key, minimum 32 characters |
| `DATABASE_URL` | Full postgres connection string (for local dev without Docker) |
| `REDIS_URL` | Redis connection string |
| `PORT` | Backend port (default: 3000) |
| `NODE_ENV` | `production` or `development` |
| `CORS_ORIGIN` | Allowed origin for CORS (e.g. `http://localhost`) |
| `LOG_LEVEL` | Pino log level (default: `info`) |

### Running locally (without Docker)

```bash
# Prerequisites: PostgreSQL 16, Redis 7, Node.js 20

# Backend
cd backend
cp ../.env .env          # ts-node reads from cwd
npm install
npm run dev              # ts-node src/index.ts on :3000

# In another terminal
npm run seed             # populates the database once

# Frontend
cd frontend
npm install
npm run dev              # Vite dev server on :5173 with /api proxy
```

---

## Schema

The full schema lives in one file:

```
backend/src/db/migrations/001_initial_schema.sql
```

**Docker Compose (automatic):** the file is mounted as `docker-entrypoint-initdb.d/001_schema.sql`, so `docker-compose up` runs it automatically on first start — no manual step needed.

**Manual (psql):** to apply it to an existing PostgreSQL instance from scratch:

```bash
createdb gridwatch
psql -d gridwatch -f backend/src/db/migrations/001_initial_schema.sql
```

Then seed with:

```bash
cd backend && npm run seed
```

---

## Schema Decisions

### All IDs are UUID, all timestamps are TIMESTAMPTZ

UUID primary keys (`gen_random_uuid()` via pgcrypto) prevent ID enumeration attacks and allow the seed to pre-assign known IDs for testing. TIMESTAMPTZ stores UTC and eliminates timezone ambiguity when sensors span geographic regions.

### `sensor_configs` is a separate table

Thresholds change independently of sensor identity. A 1:1 relationship (UNIQUE on `sensor_id`) was chosen over embedding thresholds in `sensors` to avoid wide rows and to make threshold update history feasible without altering the sensors table structure.

### `anomalies.detail` is JSONB

Each anomaly rule produces different detail fields (threshold breach: actual vs. limits; rate-of-change: delta percentage; pattern absence: last_seen_at). JSONB avoids a union-type column mess while keeping the data queryable.

### `alerts.anomaly_id UNIQUE`

One anomaly → one alert. This prevents double-alerting if a worker processes the same reading twice. The constraint is the atomic guard.

### `escalation_log.alert_id UNIQUE`

Combined with `INSERT ... ON CONFLICT DO NOTHING` and `pg_try_advisory_xact_lock`, this is the exactly-once escalation mechanism. Two concurrent workers racing to escalate the same alert will both acquire the advisory lock (serialized), but only the first INSERT succeeds; the second gets rowCount=0 and skips.

### Partial index on `alerts` for escalation

```sql
CREATE INDEX idx_alerts_escalation
  ON alerts(status, severity, opened_at)
  WHERE escalated_at IS NULL;
```

The escalation worker scans only the small fraction of alerts that haven't been escalated yet, avoiding full table scans as alert history grows.

### `readings(sensor_id, timestamp DESC)` composite index

The most common query pattern is "last N readings for sensor X." A composite index on `(sensor_id, timestamp DESC)` satisfies this with an index-only scan.

### `UNIQUE (sensor_id, timestamp)` on readings

Prevents duplicate ingestion of the same reading. The ingest route uses `INSERT ... ON CONFLICT DO NOTHING` (not strictly required in code — the constraint is the real guard).

### `alerts(sensor_id, status)` index

The sensor detail view needs to answer "does this sensor have an open alert?" on every page load. Without this index, every sensor detail request would scan all alerts for that sensor to find open ones.

### Partial index on `anomalies` for pattern absence deduplication

```sql
CREATE INDEX idx_anomalies_pattern_absence
  ON anomalies(sensor_id, triggered_at DESC)
  WHERE rule = 'pattern_absence';
```

The pattern absence worker runs every 30 seconds and checks whether a `pattern_absence` anomaly was already fired in the last 5 minutes per sensor (to avoid spamming). A partial index filtered to only `pattern_absence` rows is smaller and faster than a full-table index, and matches the exact predicate used in the dedup query.

### `alert_transitions` is append-only

Never updated, only inserted. This gives a complete audit trail of who changed an alert's status, when, and why. The `actor_type IN ('user','system')` check distinguishes operator actions from automated escalation.

---

## Real-Time Design

### Why SSE instead of WebSockets

SSE is unidirectional (server → client), which is exactly what the dashboard needs. It works over HTTP/1.1, survives proxies that block WebSocket upgrades, and automatically reconnects. The EventSource API is simpler than managing a WebSocket connection.

### Token in query string

`EventSource` does not support custom headers. The JWT is passed as `?token=<jwt>` and the backend auth middleware checks `req.query.token` as a fallback. This is acceptable for SSE connections where HTTPS ensures wire confidentiality.

### Single PSUBSCRIBE fan-out

```
Ingest → publishEvent(zone_id, event)
       → Redis PUBLISH events:zone:<zone_id>
             ↓
         redisSub (one connection, PSUBSCRIBE events:zone:*)
             ↓
         In-process EventEmitter (zone:<zone_id>)
             ↓
         All SSE handlers listening to that zone
```

One Redis subscription serves unlimited SSE clients. Adding a second backend instance would require a real Redis pub/sub (already the case here) or a message broker — the architecture already handles horizontal scaling.

### Zone isolation for SSE

Operators receive events only for their assigned zones. `subscribeClient(zoneIds, callback)` registers listeners on `zone:<id>` keys only for the user's zone list. Supervisors (`zoneIds = null`) subscribe to all zones by querying the DB at connect time.

### Keepalive

The SSE route sends `: keepalive\n\n` every 15 seconds to prevent Nginx and proxies from closing idle connections, and to let the client detect disconnections faster than the TCP timeout.

---

## What's Finished / What's Cut

### Finished

- Full ingest pipeline: bulk INSERT → async anomaly detection queue → alert creation → SSE push
- Three anomaly rules: Rule A (threshold breach), Rule B (rate-of-change %), Rule C (pattern absence >2 min)
- Alert state machine: open → acknowledged → resolved with audit trail
- Exactly-once escalation for critical alerts open >5 minutes
- Zone isolation at query layer (not application layer): operators can never see other zones
- Suppression windows: alerts during suppression are still created but marked `suppressed=true`
- Dashboard: 1050-tile virtualized sensor grid (TanStack Virtual) with live SSE-driven status updates
- Alert panel: filtering, pagination, ack/resolve actions
- Sensor detail: Recharts line chart with anomaly markers (ReferenceLine per anomaly)
- Full Docker Compose stack: one command to start everything
- Structured JSON logging with pino, X-Request-ID header on all responses
- Seed: 604,800 readings loaded in ~12s via pg-copy-streams COPY command

### Cut

- WebSocket real-time bidirectional channel (SSE is sufficient for this use case)
- Email / PagerDuty notifications on escalation (only in-app via SSE)
- Multi-region / multi-tenant isolation beyond zone-level
- Sensor config update API (configs are seeded; updating requires direct DB access)
- Historical anomaly trend charts (chart shows readings + markers, not aggregated trend)
- Refresh token rotation (JWTs are short-lived in intent but no expiry is set in the seed; prod would use short TTL + refresh)
- Rate limiting on ingest endpoint
- Integration/e2e tests (unit test structure is in place but no test suite was written)

---

## The Three Hardest Problems

### 1. Exactly-once escalation under concurrency

**Problem:** The escalation worker runs on a 15-second timer. If two instances of the backend start simultaneously (e.g., during a rolling deploy), both will find the same unescalated critical alerts and try to escalate them.

**Solution:** Two interlocking guards:
1. `pg_try_advisory_xact_lock(hashtext(alert_id))` — only one transaction holds the lock per alert at a time; the second caller gets `false` and skips.
2. `INSERT INTO escalation_log ... ON CONFLICT (alert_id) DO NOTHING` — even if the advisory lock somehow fails (cross-instance scenario), the UNIQUE constraint on `alert_id` ensures only one row is ever inserted.

The `rowCount === 0` check after the INSERT is the signal to skip the UPDATE and COMMIT, keeping the `alerts` table consistent.

### 2. History endpoint latency with 604K+ readings

**Problem:** A naive `SELECT * FROM readings WHERE sensor_id = $1 AND timestamp BETWEEN $2 AND $3` across 600K rows returned in 6+ seconds initially.

**Root cause:** The query was working, but the anomaly worker was using the shared `redis` client for `BLPOP`, which blocked the connection for up to 5 seconds. When the history service tried `redis.get(cacheKey)`, it queued behind the blocked BLPOP call.

**Solution:** Created a dedicated `redisQueue` ioredis client used exclusively by the anomaly worker for BLPOP. The shared `redis` client is now never blocked. The history query itself uses a CTE for pagination + a 30-second Redis count cache to avoid `COUNT(*)` on large result sets. Measured: **29ms** after the fix.

### 3. SSE with EventSource authentication

**Problem:** Browser's native `EventSource` API does not support setting custom headers (no `Authorization: Bearer <token>`). Sessions cannot be managed with cookies in a stateless JWT architecture without CSRF concerns.

**Solution:** Pass the JWT as a query parameter (`/api/events?token=<jwt>`). The backend `auth.ts` middleware was updated to check `req.query.token` as a fallback when the `Authorization` header is absent. Since all traffic is HTTPS in production, the token in the URL is protected on the wire (though it appears in server access logs — a known trade-off). A proper production hardening would issue a short-lived (30s) SSE-specific token from a dedicated endpoint.

---

## Benchmark Results

All measurements against the Docker Compose stack on localhost.

| Benchmark | Target | Measured |
|-----------|--------|----------|
| POST /ingest (500 readings) | < 200ms | **88ms** |
| GET /sensors/:id/history (30 days) | < 300ms | **29ms** |
| GET /alerts (paginated) | — | **19ms** |
| GET /sensors (1050 sensors) | — | **74ms** |
| SSE update latency (ingest → dashboard tile) | < 3s | **~400ms** |
| Escalation (critical open >5min → escalated_at set) | within 15s interval | **≤15s** |

The history endpoint achieves 29ms via the `(sensor_id, timestamp DESC)` index, CTE-based pagination, and a 30-second Redis count cache. The ingest endpoint responds in 88ms because anomaly detection is fully async (enqueue + respond; workers process in the background).
