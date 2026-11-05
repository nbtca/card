ALTER TABLE events ADD COLUMN album TEXT;

-- How many events a member has entered, which sets the foil on their card.
ALTER TABLE members ADD COLUMN kept INTEGER NOT NULL DEFAULT 0;
UPDATE members SET kept = (SELECT COUNT(*) FROM passes WHERE passes.email = members.email AND redeemed_at IS NOT NULL);
CREATE TRIGGER passes_kept AFTER UPDATE OF redeemed_at ON passes
WHEN OLD.redeemed_at IS NULL AND NEW.redeemed_at IS NOT NULL
BEGIN
  UPDATE members SET kept = kept + 1 WHERE email = NEW.email;
END;

-- The entry wall asks only for entries newer than the last one it has.
CREATE INDEX passes_entries ON passes (event, redeemed_at) WHERE redeemed_at IS NOT NULL;
