-- Idempotent. Failed HTTP requests recorded for the admin panel.
CREATE TABLE IF NOT EXISTS api_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method varchar(10) NOT NULL,
  path varchar(300) NOT NULL,
  status_code integer NOT NULL,
  error_code varchar(80) NOT NULL,
  message text NOT NULL,
  stack text NULL,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_api_errors_created" ON api_errors (created_at);
CREATE INDEX IF NOT EXISTS "IDX_api_errors_status_code_created" ON api_errors (status_code, error_code, created_at);
