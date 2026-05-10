alter table schedule_shift_request
    add column if not exists from_shift_value_snapshot varchar(255),
    add column if not exists to_shift_value_snapshot varchar(255),
    add column if not exists decided_by_user_id bigint,
    add column if not exists decided_at timestamptz,
    add column if not exists decision_comment text;

create index if not exists idx_schedule_shift_request_schedule_status
    on schedule_shift_request(schedule_id, status);
