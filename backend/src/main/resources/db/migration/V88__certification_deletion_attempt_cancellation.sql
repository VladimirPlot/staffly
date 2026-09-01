alter table training_exam_attempt
    drop constraint if exists chk_training_exam_attempt_cancellation_reason;

alter table training_exam_attempt
    add constraint chk_training_exam_attempt_cancellation_reason check (
        cancellation_reason is null
        or cancellation_reason in ('POSITION_CHANGED_TIMEOUT', 'EXAM_DELETED')
    );
