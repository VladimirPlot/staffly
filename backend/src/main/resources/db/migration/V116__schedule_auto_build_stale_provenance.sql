alter table schedule add column auto_build_stale_at timestamp with time zone;
alter table schedule add column auto_build_stale_reason varchar(32);

alter table schedule add constraint ck_schedule_auto_build_stale_pair check (
    (auto_build_stale_at is null and auto_build_stale_reason is null)
    or (auto_build_stale_at is not null and auto_build_stale_reason is not null)
);
