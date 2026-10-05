alter table task add column assigned_member_id bigint references restaurant_member(id);
alter table task add column setter_member_id bigint references restaurant_member(id);

do $$ begin
    if exists (
        select 1 from task t join restaurant_member rm
          on rm.restaurant_id = t.restaurant_id and rm.user_id = t.assigned_user_id
         and ((t.status = 'ACTIVE' and rm.ended_at is null)
           or (t.status = 'COMPLETED' and rm.started_at <= t.created_at
             and (rm.ended_at is null or rm.ended_at >= t.created_at)))
        where t.assigned_user_id is not null group by t.id having count(*) <> 1
    ) then raise exception 'Task membership reconciliation required: ambiguous assignee period'; end if;
    if exists (
        select 1 from task t join restaurant_member rm
          on rm.restaurant_id = t.restaurant_id and rm.user_id = t.created_by_id
         and ((t.status = 'ACTIVE' and rm.ended_at is null)
           or (t.status = 'COMPLETED' and rm.started_at <= t.created_at
             and (rm.ended_at is null or rm.ended_at >= t.created_at)))
        where t.created_by_id is not null group by t.id having count(*) <> 1
    ) then raise exception 'Task membership reconciliation required: ambiguous setter period'; end if;
end $$;

-- Active membership is authoritative for current operational tasks. Historical
-- tasks use the membership period containing task creation. Ambiguous/missing
-- rows deliberately remain null and are rejected by the validation block.
update task t set assigned_member_id = (
    select rm.id from restaurant_member rm
    where rm.restaurant_id = t.restaurant_id and rm.user_id = t.assigned_user_id
      and ((t.status = 'ACTIVE' and rm.ended_at is null)
        or (t.status = 'COMPLETED' and rm.started_at <= t.created_at
          and (rm.ended_at is null or rm.ended_at >= t.created_at)))
    order by case when rm.ended_at is null then 0 else 1 end, rm.started_at desc
    limit 1
) where t.assigned_user_id is not null;

update task t set setter_member_id = (
    select rm.id from restaurant_member rm
    where rm.restaurant_id = t.restaurant_id and rm.user_id = t.created_by_id
      and ((t.status = 'ACTIVE' and rm.ended_at is null)
        or (t.status = 'COMPLETED' and rm.started_at <= t.created_at
          and (rm.ended_at is null or rm.ended_at >= t.created_at)))
    order by case when rm.ended_at is null then 0 else 1 end, rm.started_at desc
    limit 1
) where t.created_by_id is not null;

do $$ begin
    if exists (select 1 from task where assigned_user_id is not null and assigned_member_id is null) then
        raise exception 'Task membership reconciliation required: assignee has no unambiguous membership';
    end if;
    if exists (select 1 from task where status = 'ACTIVE' and deleted_at is null
               and created_by_id is not null and setter_member_id is null) then
        raise exception 'Task membership reconciliation required: active setter has no unambiguous membership';
    end if;
    if exists (select 1 from task where created_by_id is not null and setter_member_id is null) then
        raise exception 'Task membership reconciliation required: author has no unambiguous membership period';
    end if;
end $$;

create index idx_task_assigned_member on task(assigned_member_id);
create index idx_task_setter_member on task(setter_member_id);
