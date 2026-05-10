create table if not exists schedule_audit_log (
    id bigserial primary key,
    schedule_id bigint not null references schedule(id) on delete cascade,
    actor_user_id bigint null references users(id),
    action varchar(64) not null,
    details text,
    created_at timestamptz not null
);

create index if not exists idx_schedule_audit_log_schedule_created
    on schedule_audit_log(schedule_id, created_at desc);