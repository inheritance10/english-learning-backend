-- Idempotent: safe to run more than once. Covers tables added since production
-- last synced (production runs with synchronize off).

ALTER TABLE users ADD COLUMN IF NOT EXISTS "rewardAccessUntil" timestamptz NULL;

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  type varchar(20) NOT NULL,
  message text NOT NULL,
  contact_email varchar NULL,
  platform varchar(20) NULL,
  app_version varchar(20) NULL,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_feedback_user_created" ON feedback (user_id, created_at);

CREATE TABLE IF NOT EXISTS reward_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward varchar(30) NOT NULL,
  cost integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_reward_purchases_user_reward_created" ON reward_purchases (user_id, reward, created_at);

CREATE TABLE IF NOT EXISTS quiz_answer_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  chosen_index integer NOT NULL,
  language varchar(2) NOT NULL,
  explanation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quiz_answer_explanations_key" ON quiz_answer_explanations (question_id, chosen_index, language);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature varchar(60) NOT NULL,
  model varchar(80) NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  thought_tokens integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_ai_usage_created" ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS "IDX_ai_usage_feature_created" ON ai_usage_logs (feature, created_at);

CREATE TABLE IF NOT EXISTS job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  kind varchar(10) NOT NULL,
  status varchar(10) NOT NULL,
  started_at timestamptz NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  error text NULL,
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_job_runs_started" ON job_runs (started_at);
CREATE INDEX IF NOT EXISTS "IDX_job_runs_name_started" ON job_runs (name, started_at);
