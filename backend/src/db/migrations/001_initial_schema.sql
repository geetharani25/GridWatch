-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- TABLE: zones
-- ─────────────────────────────────────────────
CREATE TABLE zones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('operator','supervisor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE: user_zones  (operator → zone assignments)
-- ─────────────────────────────────────────────
CREATE TABLE user_zones (
  user_id  UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  zone_id  UUID NOT NULL REFERENCES zones(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, zone_id)
);

-- ─────────────────────────────────────────────
-- TABLE: sensors
-- ─────────────────────────────────────────────
CREATE TABLE sensors (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      UUID        NOT NULL REFERENCES zones(id),
  name         TEXT        NOT NULL,
  location     TEXT,
  status       TEXT        NOT NULL DEFAULT 'healthy'
                             CHECK (status IN ('healthy','warning','critical','silent')),
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensors_zone_id   ON sensors(zone_id);
CREATE INDEX idx_sensors_status    ON sensors(status);
CREATE INDEX idx_sensors_last_seen ON sensors(last_seen_at);

-- ─────────────────────────────────────────────
-- TABLE: sensor_configs  (one row per sensor)
-- ─────────────────────────────────────────────
CREATE TABLE sensor_configs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id           UUID        NOT NULL UNIQUE REFERENCES sensors(id) ON DELETE CASCADE,
  voltage_min         NUMERIC(10,4),
  voltage_max         NUMERIC(10,4),
  temperature_min     NUMERIC(10,4),
  temperature_max     NUMERIC(10,4),
  rate_of_change_pct  NUMERIC(8,4),
  rule_a_severity     TEXT        NOT NULL DEFAULT 'warning'
                        CHECK (rule_a_severity IN ('warning','critical')),
  rule_b_severity     TEXT        NOT NULL DEFAULT 'warning'
                        CHECK (rule_b_severity IN ('warning','critical')),
  rule_c_severity     TEXT        NOT NULL DEFAULT 'critical'
                        CHECK (rule_c_severity IN ('warning','critical')),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE: readings
-- ─────────────────────────────────────────────
CREATE TABLE readings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id   UUID        NOT NULL REFERENCES sensors(id),
  timestamp   TIMESTAMPTZ NOT NULL,
  voltage     NUMERIC(10,4) NOT NULL,
  current     NUMERIC(10,4) NOT NULL,
  temperature NUMERIC(10,4) NOT NULL,
  status_code INTEGER      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sensor_id, timestamp)
);

CREATE INDEX idx_readings_sensor_ts ON readings(sensor_id, timestamp DESC);

-- ─────────────────────────────────────────────
-- TABLE: anomalies
-- ─────────────────────────────────────────────
CREATE TABLE anomalies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id    UUID        NOT NULL REFERENCES sensors(id),
  reading_id   UUID        REFERENCES readings(id),
  rule         TEXT        NOT NULL
                 CHECK (rule IN ('threshold_breach','rate_of_change','pattern_absence')),
  detail       JSONB       NOT NULL DEFAULT '{}',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomalies_sensor_ts  ON anomalies(sensor_id, triggered_at DESC);
CREATE INDEX idx_anomalies_reading_id ON anomalies(reading_id);

-- ─────────────────────────────────────────────
-- TABLE: alerts
-- ─────────────────────────────────────────────
CREATE TABLE alerts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id      UUID        NOT NULL UNIQUE REFERENCES anomalies(id),
  sensor_id       UUID        NOT NULL REFERENCES sensors(id),
  zone_id         UUID        NOT NULL REFERENCES zones(id),
  severity        TEXT        NOT NULL CHECK (severity IN ('warning','critical')),
  status          TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','acknowledged','resolved')),
  suppressed      BOOLEAN     NOT NULL DEFAULT FALSE,
  assigned_to     UUID        REFERENCES users(id),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  escalated_at    TIMESTAMPTZ
);

CREATE INDEX idx_alerts_zone_status_opened
  ON alerts(zone_id, status, opened_at DESC);

CREATE INDEX idx_alerts_escalation
  ON alerts(status, severity, opened_at)
  WHERE escalated_at IS NULL;

CREATE INDEX idx_alerts_sensor_id ON alerts(sensor_id);

-- ─────────────────────────────────────────────
-- TABLE: alert_transitions  (append-only audit log)
-- ─────────────────────────────────────────────
CREATE TABLE alert_transitions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID        NOT NULL REFERENCES alerts(id),
  from_status     TEXT,
  to_status       TEXT        NOT NULL,
  actor_id        UUID        REFERENCES users(id),
  actor_type      TEXT        NOT NULL CHECK (actor_type IN ('user','system')),
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            TEXT
);

CREATE INDEX idx_alert_transitions_alert
  ON alert_transitions(alert_id, transitioned_at DESC);

-- ─────────────────────────────────────────────
-- TABLE: escalation_log
-- ─────────────────────────────────────────────
CREATE TABLE escalation_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id     UUID        NOT NULL UNIQUE REFERENCES alerts(id),
  assigned_to  UUID        NOT NULL REFERENCES users(id),
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note         TEXT
);

-- ─────────────────────────────────────────────
-- TABLE: suppressions
-- ─────────────────────────────────────────────
CREATE TABLE suppressions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id  UUID        NOT NULL REFERENCES sensors(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  created_by UUID        NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_suppression_times CHECK (end_time > start_time)
);

CREATE INDEX idx_suppressions_sensor_window
  ON suppressions(sensor_id, start_time, end_time);
