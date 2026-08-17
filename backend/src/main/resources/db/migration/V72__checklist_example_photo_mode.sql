UPDATE checklist_item
SET completion_photo_mode = 'OPTIONAL'
WHERE completion_photo_mode = 'NONE'
  AND example_photo_url IS NOT NULL
  AND btrim(example_photo_url) <> '';

UPDATE checklist_item_history
SET completion_photo_mode = 'OPTIONAL'
WHERE completion_photo_mode = 'NONE'
  AND example_photo_url IS NOT NULL
  AND btrim(example_photo_url) <> '';
