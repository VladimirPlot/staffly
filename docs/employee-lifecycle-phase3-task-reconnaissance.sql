-- Run read-only before V117. Every returned row requires explicit reconciliation.

-- ACTIVE individual assignments without exactly one active membership in the task restaurant.
select t.id as task_id, t.restaurant_id, t.assigned_user_id,
       count(rm.id) as active_membership_candidates
from task t
left join restaurant_member rm on rm.restaurant_id = t.restaurant_id
  and rm.user_id = t.assigned_user_id and rm.ended_at is null
where t.status = 'ACTIVE' and t.deleted_at is null and t.assigned_user_id is not null
group by t.id, t.restaurant_id, t.assigned_user_id
having count(rm.id) <> 1;

-- Authors that cannot become an unambiguous operational setter for an ACTIVE task.
-- This also exposes CREATOR-authored tasks without a real employment membership.
select t.id as task_id, t.restaurant_id, t.created_by_id,
       count(rm.id) as active_setter_candidates
from task t
left join restaurant_member rm on rm.restaurant_id = t.restaurant_id
  and rm.user_id = t.created_by_id and rm.ended_at is null
where t.status = 'ACTIVE' and t.deleted_at is null and t.created_by_id is not null
group by t.id, t.restaurant_id, t.created_by_id
having count(rm.id) <> 1;

-- Historical periods overlapping task creation; more than one is ambiguous.
select t.id as task_id, t.restaurant_id, coalesce(t.assigned_user_id, t.created_by_id) as user_id,
       count(rm.id) as containing_periods
from task t
join restaurant_member rm on rm.restaurant_id = t.restaurant_id
 and rm.user_id = coalesce(t.assigned_user_id, t.created_by_id)
 and rm.started_at <= t.created_at and (rm.ended_at is null or rm.ended_at >= t.created_at)
where t.status = 'COMPLETED'
group by t.id, t.restaurant_id, coalesce(t.assigned_user_id, t.created_by_id)
having count(rm.id) <> 1;
