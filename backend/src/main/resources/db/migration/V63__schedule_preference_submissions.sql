create table if not exists schedule_preference_submission (
    id              bigserial primary key,
    schedule_id     bigint      not null references schedule(id) on delete cascade,
    member_id       bigint      not null references restaurant_member(id) on delete cascade,
    user_id         bigint      null,
    position_id     bigint      null,
    position_name   varchar(150) null,
    submitted_at    timestamptz not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    revision        integer     not null default 1,
    comment         text        null,
    constraint uq_schedule_pref_submission_schedule_member unique (schedule_id, member_id)
);

create index if not exists idx_schedule_pref_submission_schedule
    on schedule_preference_submission(schedule_id);
create index if not exists idx_schedule_pref_submission_member
    on schedule_preference_submission(member_id);
create index if not exists idx_schedule_pref_submission_schedule_member
    on schedule_preference_submission(schedule_id, member_id);

create table if not exists schedule_preference_cell (
    id              bigserial primary key,
    submission_id   bigint      not null references schedule_preference_submission(id) on delete cascade,
    day             date        not null,
    type            varchar(32) not null,
    full_day        boolean     not null,
    start_time      time        null,
    end_time        time        null,
    note            text        null,
    sort_order      integer     not null default 0,
    constraint chk_schedule_pref_cell_type check (type in ('AVAILABLE','UNAVAILABLE','PREFER_DAY_OFF','PREFER_WORK')),
    constraint chk_schedule_pref_cell_time check (
        (full_day = true and start_time is null and end_time is null)
        or
        (full_day = false and start_time is not null and end_time is not null and start_time < end_time)
    )
);

create index if not exists idx_schedule_pref_cell_submission
    on schedule_preference_cell(submission_id);
create index if not exists idx_schedule_pref_cell_day
    on schedule_preference_cell(day);
create index if not exists idx_schedule_pref_cell_type
    on schedule_preference_cell(type);
