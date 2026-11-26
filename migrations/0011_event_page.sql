-- How to find the venue, shown under it on the event page, such as which building and floor.
ALTER TABLE events ADD COLUMN venue_note TEXT NOT NULL DEFAULT '';

-- A 1200×630 link preview drawn by the host's browser on save; R2 keys are never reused, so each save gets a new one.
ALTER TABLE events ADD COLUMN share TEXT;
