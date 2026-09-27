create table schedule_build_marker (
    id bigserial primary key,
    position_config_id bigint not null references schedule_build_position_config(id) on delete cascade,
    name varchar(100) not null,
    constraint chk_sbm_name_not_blank check (length(btrim(name)) > 0)
);
create index idx_sbm_position_config on schedule_build_marker(position_config_id);
create unique index uq_sbm_config_name_ci on schedule_build_marker(position_config_id, lower(name));

create table schedule_build_marker_member (
    marker_id bigint not null references schedule_build_marker(id) on delete cascade,
    restaurant_member_id bigint not null references restaurant_member(id) on delete cascade,
    constraint uq_sbmm_marker_member unique (marker_id, restaurant_member_id)
);
create index idx_sbmm_member on schedule_build_marker_member(restaurant_member_id);
