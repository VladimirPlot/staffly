CREATE UNIQUE INDEX IF NOT EXISTS uq_training_exam_attempt_single_active_context
    ON training_exam_attempt (
        restaurant_id,
        user_id,
        exam_id,
        exam_version,
        COALESCE(assignment_id, 0)
    )
    WHERE finished_at IS NULL;