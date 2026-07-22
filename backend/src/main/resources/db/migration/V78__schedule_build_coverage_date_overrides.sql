create table schedule_build_coverage_date_override (
    id bigserial primary key,
    position_config_id bigint not null references schedule_build_position_config(id) on delete cascade,
    date date not null,
    shift_option_id bigint not null references schedule_build_shift_option(id) on delete cascade,
    required_count integer not null,
    constraint uq_sbcdo_config_date_shift unique (position_config_id, date, shift_option_id),
    constraint chk_sbcdo_required_count_non_negative check (required_count >= 0)
);

create index idx_sbcdo_position_config on schedule_build_coverage_date_override(position_config_id);
create index idx_sbcdo_date on schedule_build_coverage_date_override(date);
create index idx_sbcdo_shift_option on schedule_build_coverage_date_override(shift_option_id);
