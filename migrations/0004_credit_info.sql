ALTER TABLE events ADD COLUMN needs_info INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passes ADD COLUMN student_id TEXT;
ALTER TABLE passes ADD COLUMN class_name TEXT;
ALTER TABLE passes ADD COLUMN phone TEXT;
-- One pass per student per event, so a second account cannot claim twice with the same ID.
CREATE UNIQUE INDEX passes_student ON passes (event, student_id) WHERE student_id IS NOT NULL;
