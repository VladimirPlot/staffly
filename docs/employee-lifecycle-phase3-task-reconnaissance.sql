-- Run read-only before V117. Every returned row requires explicit reconciliation.

-- A/D/E: assignee or author has zero/multiple employment periods containing task creation.
with task_people as (
    select id task_id, restaurant_id, created_at, 'ASSIGNEE' relation, assigned_user_id user_id
    from task where assigned_user_id is not null
    union all
    select id, restaurant_id, created_at, 'SETTER', created_by_id
    from task where created_by_id is not null
), candidates as (
    select p.*, count(rm.id) period_count
    from task_people p left join restaurant_member rm
      on rm.restaurant_id = p.restaurant_id and rm.user_id = p.user_id
     and rm.started_at <= p.created_at
     and (rm.ended_at is null or rm.ended_at >= p.created_at)
    group by p.task_id, p.restaurant_id, p.created_at, p.relation, p.user_id
)
select * from candidates where period_count <> 1 order by task_id, relation;

-- B: ACTIVE task whose historically correct period has already ended.
select t.id task_id, x.relation, rm.id historical_member_id, rm.ended_at
from task t
cross join lateral (values ('ASSIGNEE', t.assigned_user_id), ('SETTER', t.created_by_id)) x(relation, user_id)
join restaurant_member rm on rm.restaurant_id = t.restaurant_id and rm.user_id = x.user_id
 and rm.started_at <= t.created_at and rm.ended_at >= t.created_at
where t.status = 'ACTIVE' and t.deleted_at is null and x.user_id is not null and rm.ended_at is not null;

-- C: a later active rehire exists, but did not contain task creation and must never be selected.
select t.id task_id, x.relation, historical.id historical_member_id, rehire.id rehire_member_id
from task t
cross join lateral (values ('ASSIGNEE', t.assigned_user_id), ('SETTER', t.created_by_id)) x(relation, user_id)
join restaurant_member historical on historical.restaurant_id = t.restaurant_id and historical.user_id = x.user_id
 and historical.started_at <= t.created_at and historical.ended_at >= t.created_at
join restaurant_member rehire on rehire.restaurant_id = t.restaurant_id and rehire.user_id = x.user_id
 and rehire.ended_at is null and rehire.started_at > t.created_at
where x.user_id is not null;
