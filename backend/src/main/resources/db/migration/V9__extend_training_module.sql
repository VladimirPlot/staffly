ALTER TABLE training_category DROP CONSTRAINT IF EXISTS chk_training_category_module;
ALTER TABLE training_category
    ADD CONSTRAINT chk_training_category_module CHECK (module IN ('MENU','BAR','WINE'));