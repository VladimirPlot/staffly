DROP TABLE IF EXISTS training_category_position;
DROP TABLE IF EXISTS training_item;
DROP TABLE IF EXISTS training_category;

CREATE TABLE training_folder (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  type VARCHAR(30) NOT NULL CHECK (type IN ('KNOWLEDGE', 'QUESTION_BANK')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_folder_restaurant_type ON training_folder(restaurant_id, type);
CREATE INDEX idx_training_folder_parent ON training_folder(parent_id);

CREATE TABLE training_knowledge_item (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES training_folder(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  composition TEXT,
  allergens TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_knowledge_item_folder ON training_knowledge_item(folder_id);

CREATE TABLE training_question (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES training_folder(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('SINGLE', 'MULTI', 'TRUE_FALSE', 'FILL_SELECT', 'MATCH')),
  prompt TEXT NOT NULL,
  explanation TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_question_folder ON training_question(folder_id);

CREATE TABLE training_question_option (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES training_question(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE training_question_match_pair (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES training_question(id) ON DELETE CASCADE,
  left_text TEXT NOT NULL,
  right_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE training_exam (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  question_count INT NOT NULL,
  pass_percent INT NOT NULL,
  time_limit_sec INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE training_exam_scope (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES training_exam(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES training_folder(id) ON DELETE CASCADE
);

CREATE TABLE training_exam_attempt (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES training_exam(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  score_percent INT,
  passed BOOLEAN
);

CREATE TABLE training_exam_attempt_question (
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES training_exam_attempt(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES training_question(id) ON DELETE CASCADE,
  chosen_answer_json TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);
