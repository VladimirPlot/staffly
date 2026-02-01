create table reminder (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    title varchar(200) not null,
    description text,
    created_by_member_id bigint not null references restaurant_member(id) on delete cascade,
    visible_to_admin boolean not null default true,
    target_type varchar(20) not null,
    target_position_id bigint references position(id) on delete set null,
    target_member_id bigint references restaurant_member(id) on delete set null,
    periodicity varchar(20) not null,
    time_hhmm time not null,
    day_of_week int,
    day_of_month int,
    monthly_last_day boolean not null default false,
    once_date date,
    next_fire_at timestamptz,
    last_fired_at timestamptz,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_reminder_restaurant on reminder(restaurant_id);
create index idx_reminder_restaurant_active on reminder(restaurant_id, active);
create index idx_reminder_restaurant_next_fire_at on reminder(restaurant_id, next_fire_at);
create index idx_reminder_target_member on reminder(target_member_id);
create index idx_reminder_target_position on reminder(target_position_id);
