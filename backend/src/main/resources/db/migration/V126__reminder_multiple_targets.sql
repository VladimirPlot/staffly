create table reminder_target_position (
    reminder_id bigint not null references reminder(id) on delete cascade,
    position_id bigint not null references position(id) on delete cascade,
    primary key (reminder_id, position_id)
);
create index idx_reminder_target_position_position on reminder_target_position(position_id);

create table reminder_target_member (
    reminder_id bigint not null references reminder(id) on delete cascade,
    member_id bigint not null references restaurant_member(id) on delete cascade,
    primary key (reminder_id, member_id)
);
create index idx_reminder_target_member_member on reminder_target_member(member_id);

insert into reminder_target_position (reminder_id, position_id)
select id, target_position_id from reminder where target_position_id is not null;
insert into reminder_target_member (reminder_id, member_id)
select id, target_member_id from reminder where target_member_id is not null;
