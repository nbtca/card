-- A member who has checked in shows a code; another member at the same event scans it to record that they met.
ALTER TABLE passes ADD COLUMN meet_code TEXT;
CREATE UNIQUE INDEX passes_meet_code ON passes (meet_code) WHERE meet_code IS NOT NULL;

-- One row per pair and event, with the two member ids in sorted order so a pair is stored once.
CREATE TABLE meets (
  event      TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event, a, b)
);
CREATE INDEX meets_pair ON meets (a, b);
CREATE INDEX meets_b ON meets (b);
