-- A repair day shows the repair tickets opened while it is on, read from Saturday by the visitor's browser.
ALTER TABLE events ADD COLUMN repair INTEGER NOT NULL DEFAULT 0;
