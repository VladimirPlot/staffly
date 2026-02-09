DROP INDEX IF EXISTS uq_training_category_rest_mod_name;
CREATE UNIQUE INDEX uq_training_category_rest_mod_name
  ON training_category (restaurant_id, module, lower(name))
  WHERE is_active = true;

DROP INDEX IF EXISTS uq_training_item_cat_name;
CREATE UNIQUE INDEX uq_training_item_cat_name
  ON training_item (category_id, lower(name))
  WHERE is_active = true;
