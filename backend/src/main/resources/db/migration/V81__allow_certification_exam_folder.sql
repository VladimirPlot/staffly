ALTER TABLE training_exam
    DROP CONSTRAINT IF EXISTS chk_training_exam_mode_folder;

ALTER TABLE training_exam
    ADD CONSTRAINT chk_training_exam_mode_folder CHECK (
        mode <> 'PRACTICE' OR folder_id IS NOT NULL
    ) NOT VALID;

ALTER TABLE training_exam
    VALIDATE CONSTRAINT chk_training_exam_mode_folder;
