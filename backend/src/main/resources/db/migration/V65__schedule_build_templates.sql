create table if not exists schedule_build_template (
    id bigserial primary key,
    restaurant_id bigint not null,
    name varchar(150) not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_sbt_restaurant foreign key (restaurant_id) references restaurant(id) on delete cascade
);

create index if not exists idx_sbt_restaurant on schedule_build_template(restaurant_id);
create unique index if not exists uq_sbt_restaurant_name_lower on schedule_build_template(restaurant_id, lower(name));

create table if not exists schedule_build_position_config (
    id bigserial primary key,
    template_id bigint not null,
    position_id bigint not null,
    full_shift_start time not null,
    full_shift_end time not null,
    min_rest_hours integer,
    max_shifts_per_period integer,
    target_pattern varchar(20),
    sort_order integer not null default 0,
    constraint fk_sbpc_template foreign key (template_id) references schedule_build_template(id) on delete cascade,
    constraint fk_sbpc_position foreign key (position_id) references position(id),
    constraint uq_sbpc_template_position unique (template_id, position_id),
    constraint chk_sbpc_full_shift_interval check (
        full_shift_start <> full_shift_end
        and (full_shift_end = time '00:00:00' or full_shift_start < full_shift_end)
    )
);

create index if not exists idx_sbpc_template on schedule_build_position_config(template_id);
create index if not exists idx_sbpc_position on schedule_build_position_config(position_id);

create table if not exists schedule_build_shift_option (
    id bigserial primary key,
    position_config_id bigint not null,
    start_time time not null,
    end_time time not null,
    label varchar(150),
    is_full_shift boolean not null default false,
    sort_order integer not null default 0,
    constraint fk_sbso_position_config foreign key (position_config_id) references schedule_build_position_config(id) on delete cascade,
    constraint chk_sbso_interval check (
        start_time <> end_time
        and (end_time = time '00:00:00' or start_time < end_time)
    )
);

create index if not exists idx_sbso_position_config on schedule_build_shift_option(position_config_id);

create table if not exists schedule_build_coverage_rule (
    id bigserial primary key,
    position_config_id bigint not null,
    day_of_week integer not null,
    start_time time not null,
    end_time time not null,
    required_count integer not null,
    sort_order integer not null default 0,
    constraint fk_sbcr_position_config foreign key (position_config_id) references schedule_build_position_config(id) on delete cascade,
    constraint chk_sbcr_day_of_week check (day_of_week between 1 and 7),
    constraint chk_sbcr_required_count check (required_count > 0),
    constraint chk_sbcr_interval check (
        start_time <> end_time
        and (end_time = time '00:00:00' or start_time < end_time)
    )
);

create index if not exists idx_sbcr_position_config on schedule_build_coverage_rule(position_config_id);
create index if not exists idx_sbcr_day_of_week on schedule_build_coverage_rule(day_of_week);
