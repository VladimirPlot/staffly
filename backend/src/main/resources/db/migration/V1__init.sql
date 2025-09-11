CREATE TABLE IF NOT EXISTS restaurants (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    code         VARCHAR(64)  NOT NULL UNIQUE,  -- системный код/слаг (например, "staffly-demo")
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    phone          VARCHAR(32)  NOT NULL,         -- +7...
    email          VARCHAR(255),
    full_name      VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Роли справочник
CREATE TABLE IF NOT EXISTS roles (
    id    BIGSERIAL PRIMARY KEY,
    code  VARCHAR(32) NOT NULL UNIQUE,  -- ADMIN, MANAGER, WAITER, TRAINEE, HOSTESS, BARTENDER, COOK
    name  VARCHAR(128) NOT NULL
);

-- Пользовательские роли в контексте ресторана (мульти‑тенантность)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, restaurant_id, role_id)
);

-- Индексы для быстрого отбора по ресторану/пользователю
CREATE INDEX IF NOT EXISTS idx_user_roles_restaurant ON user_roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user       ON user_roles(user_id);

-- Базовые роли
INSERT INTO roles(code, name) VALUES
  ('ADMIN',     'Администратор'),
  ('MANAGER',   'Управляющий'),
  ('WAITER',    'Официант'),
  ('TRAINEE',   'Стажёр'),
  ('HOSTESS',   'Хостес'),
  ('BARTENDER', 'Бармен'),
  ('COOK',      'Повар')
ON CONFLICT (code) DO NOTHING;