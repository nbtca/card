-- Everyone who hosts an event. Hosts are credited once the first guest checks in, so an event that never happens counts for nobody.
CREATE TABLE hosts (
  event       TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  credited_at INTEGER,
  PRIMARY KEY (event, email)
);
CREATE INDEX hosts_by_email ON hosts (email, created_at);

ALTER TABLE members ADD COLUMN hosted INTEGER NOT NULL DEFAULT 0;

INSERT INTO hosts (event, email, created_at, credited_at)
SELECT slug, created_by, created_at, (SELECT MIN(redeemed_at) FROM passes WHERE event = slug AND email != created_by) FROM events WHERE created_by != '';

-- A credited host counts as having entered, unless they were also checked in on a guest pass.
UPDATE members SET
  hosted = (SELECT COUNT(*) FROM hosts WHERE email = members.email AND credited_at IS NOT NULL),
  kept = kept + (
    SELECT COUNT(*) FROM hosts h WHERE h.email = members.email AND h.credited_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM passes p WHERE p.event = h.event AND p.email = h.email AND p.redeemed_at IS NOT NULL)
  );

CREATE TRIGGER hosts_credited AFTER UPDATE OF credited_at ON hosts
WHEN OLD.credited_at IS NULL AND NEW.credited_at IS NOT NULL
BEGIN
  UPDATE members SET hosted = hosted + 1,
    kept = kept + NOT EXISTS (SELECT 1 FROM passes WHERE event = NEW.event AND email = NEW.email AND redeemed_at IS NOT NULL)
  WHERE email = NEW.email;
END;

CREATE TRIGGER hosts_added AFTER INSERT ON hosts
WHEN NEW.credited_at IS NOT NULL
BEGIN
  UPDATE members SET hosted = hosted + 1,
    kept = kept + NOT EXISTS (SELECT 1 FROM passes WHERE event = NEW.event AND email = NEW.email AND redeemed_at IS NOT NULL)
  WHERE email = NEW.email;
END;

CREATE TRIGGER hosts_removed AFTER DELETE ON hosts
WHEN OLD.credited_at IS NOT NULL
BEGIN
  UPDATE members SET hosted = hosted - 1,
    kept = kept - NOT EXISTS (SELECT 1 FROM passes WHERE event = OLD.event AND email = OLD.email AND redeemed_at IS NOT NULL)
  WHERE email = OLD.email;
END;

DROP TRIGGER passes_kept;
CREATE TRIGGER passes_kept AFTER UPDATE OF redeemed_at ON passes
WHEN OLD.redeemed_at IS NULL AND NEW.redeemed_at IS NOT NULL
BEGIN
  UPDATE members SET kept = kept + NOT EXISTS (SELECT 1 FROM hosts WHERE event = NEW.event AND email = NEW.email AND credited_at IS NOT NULL)
  WHERE email = NEW.email;
  UPDATE hosts SET credited_at = NEW.redeemed_at
  WHERE event = NEW.event AND credited_at IS NULL AND NOT EXISTS (SELECT 1 FROM hosts WHERE event = NEW.event AND email = NEW.email);
END;
