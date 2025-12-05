create table schedule_shift_request (
    id bigserial primary key,
    schedule_id bigint not null references schedule(id) on delete cascade,
    type varchar(32) not null,
    day_from date not null,
    day_to date,
    from_row_id bigint not null references schedule_row(id) on delete cascade,
    to_row_id bigint not null references schedule_row(id) on delete cascade,
    initiator_member_id bigint not null,
    from_member_id bigint not null,
    to_member_id bigint not null,
    reason text,
    status varchar(32) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_shift_request_schedule on schedule_shift_request(schedule_id);
create index idx_shift_request_from_row on schedule_shift_request(from_row_id);
create index idx_shift_request_to_row on schedule_shift_request(to_row_id);