-- When the server learned of each check-in. A scan queued offline keeps its scan time in redeemed_at but arrives
-- later, and the entry wall follows arrivals so it never skips one.
ALTER TABLE passes ADD COLUMN received_at INTEGER;
UPDATE passes SET received_at = redeemed_at WHERE redeemed_at IS NOT NULL;
DROP INDEX passes_entries;
CREATE INDEX passes_received ON passes (event, received_at) WHERE received_at IS NOT NULL;
