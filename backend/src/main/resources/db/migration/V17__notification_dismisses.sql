create table notification_dismisses (
    id bigserial primary key,
    notification_id bigint not null references notifications(id) on delete cascade,
    member_id bigint not null references restaurant_member(id) on delete cascade,
    dismissed_at timestamptz not null default now(),
    constraint uq_notification_dismiss unique (notification_id, member_id)
);

create index idx_notification_dismiss_member on notification_dismisses(member_id);
create index idx_notification_dismiss_notification on notification_dismisses(notification_id);