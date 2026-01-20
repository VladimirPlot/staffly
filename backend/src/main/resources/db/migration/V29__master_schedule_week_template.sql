create table master_schedule_week_template (
    id bigserial primary key,
    schedule_id bigint not null references master_schedule(id) on delete cascade,
    position_id bigint not null references position(id),
    weekday varchar(10) not null,
    employees_count int,
    units numeric(12, 2),
    unique (schedule_id, position_id, weekday)
);

create index idx_ms_week_template_schedule on master_schedule_week_template(schedule_id);
create index idx_ms_week_template_position on master_schedule_week_template(position_id);
