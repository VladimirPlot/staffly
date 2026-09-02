alter table training_exam_attempt
    add column position_at_start_id bigint,
    add column cancellation_reason varchar(40),
    add constraint chk_training_exam_attempt_cancellation_reason check (
        cancellation_reason is null or cancellation_reason in ('POSITION_CHANGED_TIMEOUT')
    );
