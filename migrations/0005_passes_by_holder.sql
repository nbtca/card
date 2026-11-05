-- A visitor's own passes, newest first: the stub shelf and the prefilled credit form both read them.
CREATE INDEX passes_holder ON passes (email, created_at);
