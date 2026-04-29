alter table schedule add column if not exists created_by_user_id bigint;
alter table schedule add column if not exists owner_user_id bigint;
alter table schedule add column if not exists owner_member_id bigint;

update schedule s
set owner_member_id = m.id,
    owner_user_id = m.user_id
from lateral (
    select rm.id, rm.user_id
    from restaurant_member rm
    where rm.restaurant_id = s.restaurant_id
      and rm.role in ('ADMIN', 'MANAGER')
    order by case when rm.role='ADMIN' then 0 else 1 end, rm.id
    limit 1
) m
where s.owner_member_id is null;

alter table schedule
    add constraint fk_schedule_created_by_user
        foreign key (created_by_user_id) references users(id);

alter table schedule
    add constraint fk_schedule_owner_user
        foreign key (owner_user_id) references users(id);

alter table schedule
    add constraint fk_schedule_owner_member
        foreign key (owner_member_id) references restaurant_member(id);

create index if not exists idx_schedule_owner_user on schedule(owner_user_id);
create index if not exists idx_schedule_owner_member on schedule(owner_member_id);
