create table if not exists schedule_build_position_config_position (
    position_config_id bigint not null,
    position_id bigint not null,
    constraint uq_sbpcp_config_position unique (position_config_id, position_id),
    constraint fk_sbpcp_config foreign key (position_config_id) references schedule_build_position_config(id) on delete cascade,
    constraint fk_sbpcp_position foreign key (position_id) references position(id) on delete cascade
);

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_name = 'schedule_build_position_config'
          and column_name = 'position_id'
    ) then
        insert into schedule_build_position_config_position (position_config_id, position_id)
        select id, position_id
        from schedule_build_position_config
        where position_id is not null
        on conflict on constraint uq_sbpcp_config_position do nothing;
    end if;
end $$;

drop index if exists idx_sbpc_position;

alter table schedule_build_position_config
    drop constraint if exists uq_sbpc_template_position,
    drop constraint if exists fk_sbpc_position,
    drop column if exists position_id;

create index if not exists idx_sbpcp_config on schedule_build_position_config_position(position_config_id);
create index if not exists idx_sbpcp_position on schedule_build_position_config_position(position_id);
