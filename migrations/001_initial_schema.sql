-- Reference schema for a PostgreSQL deployment. The local no-cost demo uses the
-- equivalent JSON persistence adapter in src/store.js.
CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE widgets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, fields JSONB NOT NULL, button_text TEXT NOT NULL, display_options JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE INDEX widgets_tenant_id_idx ON widgets(tenant_id);
CREATE TABLE submissions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), widget_id TEXT NOT NULL REFERENCES widgets(id), payload JSONB NOT NULL, geo JSONB, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE INDEX submissions_tenant_widget_created_idx ON submissions(tenant_id, widget_id, created_at DESC);
CREATE TABLE idempotency_keys (key TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), created_at TIMESTAMPTZ NOT NULL);
