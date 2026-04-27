-- Composite lookup index for certification progress queries.
CREATE INDEX IF NOT EXISTS idx_training_exam_assignment_exam_restaurant_active_status
    ON training_exam_assignment(exam_id, restaurant_id, is_active, status);