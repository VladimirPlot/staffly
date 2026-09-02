ALTER TABLE training_folder
    DROP CONSTRAINT IF EXISTS training_folder_type_check;

ALTER TABLE training_folder
    ADD CONSTRAINT training_folder_type_check
        CHECK (type IN ('KNOWLEDGE', 'QUESTION_BANK', 'CERTIFICATION'));
