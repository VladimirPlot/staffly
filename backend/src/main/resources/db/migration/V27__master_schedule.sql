alter table position
    add column pay_type varchar(20) not null default 'HOURLY',
    add column pay_rate numeric(12, 2),
    add column norm_hours int;

create table master_schedule (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id),
    name varchar(120) not null,
    period_start date not null,
    period_end date not null,
    planned_revenue numeric(14, 2),
    deleted_at timestamptz,
    version bigint not null default 0
);

create index idx_master_schedule_restaurant on master_schedule(restaurant_id);
create index idx_master_schedule_restaurant_active on master_schedule(restaurant_id) where deleted_at is null;

create table master_schedule_row (
    id bigserial primary key,
    schedule_id bigint not null references master_schedule(id) on delete cascade,
    position_id bigint not null references position(id),
    row_index int not null,
    rate_override numeric(12, 2),
    amount_override numeric(14, 2),
    pay_type_override varchar(20),
    version bigint not null default 0
);

create index idx_master_schedule_row_schedule on master_schedule_row(schedule_id);
create index idx_master_schedule_row_position on master_schedule_row(position_id);

create table master_schedule_cell (
    id bigserial primary key,
    row_id bigint not null references master_schedule_row(id) on delete cascade,
    work_date date not null,
    value_raw varchar(64),
    value_num numeric(12, 2),
    units_count int,
    version bigint not null default 0,
    unique (row_id, work_date)
);

create index idx_master_schedule_cell_row on master_schedule_cell(row_id);
create index idx_master_schedule_cell_date on master_schedule_cell(work_date);

create table master_schedule_week_template_position (
    id bigserial primary key,
    schedule_id bigint not null references master_schedule(id) on delete cascade,
    position_id bigint not null references position(id),
    unique (schedule_id, position_id)
);

create index idx_ms_week_template_position_schedule on master_schedule_week_template_position(schedule_id);
create index idx_ms_week_template_position_position on master_schedule_week_template_position(position_id);

create table master_schedule_week_template_cell (
    id bigserial primary key,
    schedule_id bigint not null references master_schedule(id) on delete cascade,
    position_id bigint not null references position(id),
    weekday varchar(10) not null,
    staff_count int,
    units numeric(12, 2),
    unique (schedule_id, position_id, weekday)
);

create index idx_ms_week_template_cell_schedule on master_schedule_week_template_cell(schedule_id);
create index idx_ms_week_template_cell_position on master_schedule_week_template_cell(position_id);
