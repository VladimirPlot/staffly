ALTER TABLE training_exam_source_folder
    ADD COLUMN include_descendants boolean NOT NULL DEFAULT false;
ALTER TABLE certification_assessment_folder_source
    ADD COLUMN include_descendants boolean NOT NULL DEFAULT false;
