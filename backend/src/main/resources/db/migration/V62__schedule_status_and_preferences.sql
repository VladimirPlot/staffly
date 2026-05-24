alter table schedule
    add column if not exists status varchar(32);

update schedule
set status = 'PUBLISHED'
where status is null;

alter table schedule
    alter column status set not null;

alter table schedule
    alter column status set default 'PUBLISHED';

alter table schedule
    add column if not exists preference_collection_started_at timestamptz,
    add column if not exists preference_deadline timestamptz,
    add column if not exists preference_closed_at timestamptz,
    add column if not exists preference_applied_at timestamptz;

create index if not exists idx_schedule_restaurant_status
    on schedule(restaurant_id, status);
