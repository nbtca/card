CREATE TABLE members (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  alias      TEXT NOT NULL,
  section    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT '社员',
  joined     INTEGER NOT NULL,
  github     TEXT,
  word       TEXT,
  motto      TEXT,
  hue        INTEGER NOT NULL DEFAULT 210,
  portrait   TEXT,
  background TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE events (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  word       TEXT NOT NULL,
  design     TEXT NOT NULL DEFAULT 'default',
  starts_at  TEXT NOT NULL,
  venue      TEXT NOT NULL,
  summary    TEXT NOT NULL DEFAULT '',
  video      TEXT,
  capacity   INTEGER,
  open       INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
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
