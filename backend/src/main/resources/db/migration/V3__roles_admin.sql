-- V3: миграция на новую модель ролей + очистка legacy-таблиц

-- 1) Перевод старого OWNER -> ADMIN (если такие записи есть)
UPDATE restaurant_member
SET role = 'ADMIN'
WHERE role = 'OWNER';

-- 2) Обновляем CHECK-констрейнт допустимых значений ролей
ALTER TABLE restaurant_member DROP CONSTRAINT IF EXISTS chk_member_role;
ALTER TABLE restaurant_member
  ADD CONSTRAINT chk_member_role
  CHECK (role IN ('ADMIN','MANAGER','STAFF'));

-- 3) Миграция данных из legacy user_roles/roles -> restaurant_member (если таблицы существуют)
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.roles') IS NOT NULL THEN

    -- Вставляем отсутствующие членства; маппим к enum restaurant_member.role
    INSERT INTO restaurant_member (user_id, restaurant_id, role, created_at)
    SELECT ur.user_id,
           ur.restaurant_id,
           CASE r.code
             WHEN 'ADMIN'   THEN 'ADMIN'
             WHEN 'MANAGER' THEN 'MANAGER'
             ELSE 'STAFF'
           END AS role,
           NOW()::timestamp
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    LEFT JOIN restaurant_member m
      ON m.user_id = ur.user_id
     AND m.restaurant_id = ur.restaurant_id
    WHERE m.id IS NULL;
  END IF;
END$$;

-- 4) Чистим legacy-таблицы (если есть)
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;