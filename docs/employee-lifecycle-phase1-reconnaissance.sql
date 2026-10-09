-- Read-only snapshot. Save the result before applying V115.
-- Supplemental reconnaissance only. The complete V114 production gate is
-- docs/production-lifecycle-migration-preflight.sql (also checks audit and V117).
SELECT m.id, m.user_id, m.restaurant_id, m.role, m.position_id
FROM restaurant_member m WHERE m.position_id IS NULL ORDER BY m.restaurant_id, m.id;

SELECT m.id, m.user_id, m.restaurant_id, m.role AS member_role,
       p.id AS position_id, p.name AS position_name, p.level AS position_level
FROM restaurant_member m JOIN position p ON p.id = m.position_id
WHERE m.role IS DISTINCT FROM p.level ORDER BY m.restaurant_id, m.id;

SELECT m.id, m.user_id, m.restaurant_id AS membership_restaurant_id,
       p.id AS position_id, p.restaurant_id AS position_restaurant_id
FROM restaurant_member m JOIN position p ON p.id = m.position_id
WHERE p.restaurant_id IS DISTINCT FROM m.restaurant_id
ORDER BY m.restaurant_id, m.id;

SELECT user_id, restaurant_id, count(*) FROM restaurant_member
GROUP BY user_id, restaurant_id HAVING count(*) > 1;

-- CREATOR is configuration-backed, so substitute the deployed creator phones/emails here.
SELECT m.*, u.phone, u.email FROM restaurant_member m JOIN users u ON u.id = m.user_id
WHERE u.phone IN ('<creator-phone>') OR u.email IN ('<creator-email>');
-- Review these rows and their dependencies manually. Remove only synthetic rows with no
-- business history; preserve/close real employment periods during controlled preparation.

SELECT restaurant_id,
       count(*) FILTER (WHERE role = 'ADMIN') AS admins_by_member_role,
       count(*) FILTER (WHERE p.level = 'ADMIN') AS admins_by_position_level
FROM restaurant_member m LEFT JOIN position p ON p.id = m.position_id GROUP BY restaurant_id;

SELECT count(*) AS schedule_rows_without_member FROM schedule_row WHERE member_id IS NULL;
SELECT sp.* FROM schedule_participation sp LEFT JOIN schedule_row sr
  ON sr.schedule_id = sp.schedule_id AND sr.member_id = sp.member_id WHERE sr.id IS NULL;
SELECT sr.* FROM schedule_row sr LEFT JOIN schedule_participation sp
  ON sp.schedule_id = sr.schedule_id AND sp.member_id = sr.member_id
JOIN schedule s ON s.id = sr.schedule_id
WHERE sr.member_id IS NOT NULL AND sp.id IS NULL AND s.status <> 'PUBLISHED';

SELECT tc.table_name, kcu.column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'restaurant_member'
ORDER BY tc.table_name, kcu.column_name;
