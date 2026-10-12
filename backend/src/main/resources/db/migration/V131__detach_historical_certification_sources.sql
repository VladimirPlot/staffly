-- V128 froze question content/keys. These IDs now describe historical selections,
-- not live references: deleting unused bank sources must not alter published versions.
-- Keep source rows, IDs, pick rules, uniqueness and immutability triggers unchanged.
ALTER TABLE certification_assessment_folder_source
    DROP CONSTRAINT certification_assessment_folder_source_folder_id_fkey;
ALTER TABLE certification_assessment_question_source
    DROP CONSTRAINT certification_assessment_question_source_question_id_fkey;
