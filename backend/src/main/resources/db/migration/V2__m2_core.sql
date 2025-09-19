-- V2__m2_core.sql — базовые таблицы для сотрудников, ролей, справочников и инвайтов
-- Требуются таблицы users(id) и restaurants(id)

-- 1) Таблица должностей (position)
CREATE TABLE IF NOT EXISTS position (
  id             BIGSERIAL PRIMARY KEY,
  restaurant_id  BIGINT        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           VARCHAR(100)  NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_position_restaurant ON position(restaurant_id);
-- кейс-инсенситивная уникальность имен должностей в пределах ресторана
CREATE UNIQUE INDEX IF NOT EXISTS uq_position_restaurant_name
  ON position (restaurant_id, lower(name));

-- 2) Таблица смен (shift)
CREATE TABLE IF NOT EXISTS shift (
  id             BIGSERIAL PRIMARY KEY,
  restaurant_id  BIGINT        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           VARCHAR(100)  NOT NULL,
  start_time     TIME          NOT NULL,
  end_time       TIME          NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_shift_restaurant ON shift(restaurant_id);
-- кейс-инсенситивная уникальность имен смен в пределах ресторана
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_restaurant_name
  ON shift (restaurant_id, lower(name));

-- 3) Членство пользователя в ресторане + роль
CREATE TABLE IF NOT EXISTS restaurant_member (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id    BIGINT        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role             VARCHAR(20)   NOT NULL,
  position_id      BIGINT        NULL REFERENCES position(id) ON DELETE SET NULL,
  avatar_url       TEXT          NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_user_restaurant UNIQUE (user_id, restaurant_id),
  CONSTRAINT chk_member_role CHECK (role IN ('OWNER','MANAGER','STAFF'))
);
CREATE INDEX IF NOT EXISTS idx_member_restaurant ON restaurant_member(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_member_user ON restaurant_member(user_id);

-- 4) Инвайты в ресторан
CREATE TABLE IF NOT EXISTS invitation (
  id               BIGSERIAL PRIMARY KEY,
  restaurant_id    BIGINT        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_or_email   VARCHAR(255)  NOT NULL,
  token            VARCHAR(64)   NOT NULL UNIQUE,
  status           VARCHAR(20)   NOT NULL,
  expires_at       TIMESTAMPTZ   NOT NULL,
  invited_by       BIGINT        NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_invitation_status CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','CANCELED'))
);
CREATE INDEX IF NOT EXISTS idx_invitation_restaurant ON invitation(restaurant_id);