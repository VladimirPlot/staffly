-- Migrate deprecated schedule shift request statuses to the simplified flow
update schedule_shift_request
set status = 'PENDING_MANAGER'
where status = 'PENDING_TARGET';

update schedule_shift_request
set status = 'REJECTED_BY_MANAGER'
where status = 'REJECTED_BY_TARGET';

update schedule_shift_request
set status = 'REJECTED_BY_MANAGER'
where status = 'CANCELLED';

-- Targeted notifications for restaurant members
create table if not exists notification_members (
    notification_id bigint not null,
    member_id bigint not null,
    constraint fk_notification_members_notification foreign key (notification_id) references notifications (id),
    constraint fk_notification_members_member foreign key (member_id) references restaurant_member (id),
    constraint uq_notification_member unique (notification_id, member_id)
);

create index if not exists idx_notification_members_member on notification_members(member_id);