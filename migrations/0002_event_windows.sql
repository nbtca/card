-- No events existed before this release, so the tables are rebuilt instead of altered.
DROP TABLE passes;
DROP TABLE events;

CREATE TABLE events (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  word        TEXT NOT NULL,
  design      TEXT NOT NULL DEFAULT 'default',
  venue       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  video       TEXT,
  capacity    INTEGER,
  claim_from  TEXT NOT NULL,
  claim_until TEXT NOT NULL,
  starts_at   TEXT NOT NULL,
  ends_at     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE passes (
  id          TEXT PRIMARY KEY,
  event       TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  serial      INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  redeemed_at INTEGER,
  redeemed_by TEXT,
  UNIQUE (event, email),
  UNIQUE (event, serial)
);
