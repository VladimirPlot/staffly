create table schedule_change (
    id bigserial primary key,
    schedule_id bigint not null references schedule(id) on delete cascade,
    actor_user_id bigint not null references users(id),
    actor_display_name varchar(255) not null,
    created_at timestamptz not null
);

create table schedule_change_item (
    id bigserial primary key,
    change_id bigint not null references schedule_change(id) on delete cascade,
    member_id bigint,
    row_id bigint,
    member_display_name varchar(255) not null,
    day date not null,
    old_value text,
    new_value text,
    old_source varchar(32),
    new_source varchar(32)
);

create index idx_schedule_change_schedule_created
    on schedule_change(schedule_id, created_at desc, id desc);
create index idx_schedule_change_item_change_order
    on schedule_change_item(change_id, day, member_id, row_id, id);
