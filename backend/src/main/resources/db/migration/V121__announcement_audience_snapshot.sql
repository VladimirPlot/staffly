-- Legacy announcements were addressed by position. Preserve their current receipt count
-- without adding recipients or resending push; subsequent sends save a snapshot themselves.
UPDATE inbox_messages m
SET metadata = metadata || jsonb_build_object('announcement', jsonb_build_object(
    'audience', 'POSITIONS',
    'recipientCount', (SELECT count(*) FROM inbox_recipients r WHERE r.message_id = m.id),
    'recipients', '[]'::jsonb,
    'positions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'active', p.is_active, 'level', p.level) ORDER BY p.id)
        FROM inbox_message_positions mp
        JOIN position p ON p.id = mp.position_id
        WHERE mp.message_id = m.id
    ), '[]'::jsonb)
))
WHERE m.type = 'ANNOUNCEMENT';
