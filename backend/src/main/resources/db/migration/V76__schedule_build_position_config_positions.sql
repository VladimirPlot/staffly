create table if not exists schedule_build_position_config_position (
    position_config_id bigint not null,
    position_id bigint not null,
    sort_order integer,
    constraint uq_sbpcp_config_position unique (position_config_id, position_id),
    constraint fk_sbpcp_config foreign key (position_config_id) references schedule_build_position_config(id) on delete cascade,
    constraint fk_sbpcp_position foreign key (position_id) references position(id) on delete cascade
);

insert into schedule_build_position_config_position (position_config_id, position_id, sort_order)
select id, position_id, 0
from schedule_build_position_config
where position_id is not null
on conflict do nothing;

drop index if exists idx_sbpc_position;
alter table schedule_build_position_config drop constraint if exists uq_sbpc_template_position;
create index if not exists idx_sbpcp_config on schedule_build_position_config_position(position_config_id);
create index if not exists idx_sbpcp_position on schedule_build_position_config_position(position_id);
