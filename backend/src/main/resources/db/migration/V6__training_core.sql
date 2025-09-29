-- Категории обучения (модуль: MENU или BAR)
CREATE TABLE IF NOT EXISTS training_category (
  id             BIGSERIAL PRIMARY KEY,
  restaurant_id  BIGINT       NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  module         VARCHAR(20)  NOT NULL,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  sort_order     INT          NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_training_category_module CHECK (module IN ('MENU','BAR'))
);

CREATE INDEX IF NOT EXISTS idx_training_category_restaurant ON training_category(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_training_category_module ON training_category(module);

-- Уникальность имени категории в рамках ресторана и модуля (кейc-инсенситивно)
CREATE UNIQUE INDEX IF NOT EXISTS uq_training_category_rest_mod_name
  ON training_category (restaurant_id, module, lower(name));

-- Видимость категорий по должностям (позициям)
CREATE TABLE IF NOT EXISTS training_category_position (
  category_id  BIGINT NOT NULL REFERENCES training_category(id) ON DELETE CASCADE,
  position_id  BIGINT NOT NULL REFERENCES position(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, position_id)
);
CREATE INDEX IF NOT EXISTS idx_tcp_position ON training_category_position(position_id);

-- Элементы (карточки) внутри категории
CREATE TABLE IF NOT EXISTS training_item (
  id            BIGSERIAL PRIMARY KEY,
  category_id   BIGINT        NOT NULL REFERENCES training_category(id) ON DELETE CASCADE,
  name          VARCHAR(150)  NOT NULL,
  description   TEXT,            -- общее описание (для меню/бара)
  composition   TEXT,            -- для "Меню": состав (опц.)
  allergens     TEXT,            -- для "Меню": аллергены (опц.)
  image_url     TEXT,            -- ссылка на картинку (опц.)
  sort_order    INT             NOT NULL DEFAULT 0,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_item_category ON training_item(category_id);

-- Уникальность названий карточек в рамках категории (кейc-инсенситивно)
CREATE UNIQUE INDEX IF NOT EXISTS uq_training_item_cat_name
  ON training_item (category_id, lower(name));