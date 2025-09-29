-- Добавляем уровень доступа позиции (связан с RestaurantRole)
ALTER TABLE position
  ADD COLUMN level VARCHAR(20) NOT NULL DEFAULT 'STAFF';

ALTER TABLE position
  ADD CONSTRAINT chk_position_level
  CHECK (level IN ('ADMIN','MANAGER','STAFF'));