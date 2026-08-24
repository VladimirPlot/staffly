-- Before 7G.2, a per-user reset archived an assignment and inserted another row for
-- the same global version. Preserve those rows (and their attempt FKs) as generations.
alter table training_exam_assignment
    add column if not exists reset_generation int not null default 0;

-- Deterministic for both legacy duplicates and a database on which an earlier V84
-- draft was never applied. The active/newest row receives the greatest generation.
with duplicate_scopes as (
    select exam_id, user_id, exam_version_snapshot
    from training_exam_assignment
    group by exam_id, user_id, exam_version_snapshot
    having count(*) > 1
), ranked as (
    select assignment.id,
           (row_number() over (
               partition by assignment.exam_id, assignment.user_id, assignment.exam_version_snapshot
               order by assignment.is_active asc, assignment.assigned_at asc, assignment.id asc
           ) - 1)::int as generation
    from training_exam_assignment assignment
    join duplicate_scopes duplicate
      on duplicate.exam_id = assignment.exam_id
     and duplicate.user_id = assignment.user_id
     and duplicate.exam_version_snapshot = assignment.exam_version_snapshot
)
update training_exam_assignment assignment
set reset_generation = ranked.generation
from ranked
where ranked.id = assignment.id;

alter table training_exam_assignment
    add constraint chk_training_exam_assignment_reset_generation
    check (reset_generation >= 0);

drop index if exists uq_training_exam_assignment_cycle;
create unique index uq_training_exam_assignment_cycle_generation
    on training_exam_assignment(exam_id, user_id, exam_version_snapshot, reset_generation);

-- There is one start-eligible projection per employee/exam. Old IN_PROGRESS rows are
-- made inactive on transition but retain their status and attempt FK, so this index
-- does not prevent a separate next-cycle assignment from being created.
-- Normalize only eligibility if corrupt/pre-index legacy data has several active rows;
-- assignment/result rows and their attempts are deliberately left untouched.
drop index if exists uq_training_exam_assignment_active_scope;
with ranked_active as (
    select id,
           row_number() over (
               partition by exam_id, restaurant_id, user_id
               order by exam_version_snapshot desc, reset_generation desc, assigned_at desc, id desc
           ) as active_rank
    from training_exam_assignment
    where is_active = true
)
update training_exam_assignment assignment
set is_active = false
from ranked_active
where ranked_active.id = assignment.id
  and ranked_active.active_rank > 1;

create unique index uq_training_exam_assignment_active_scope
    on training_exam_assignment(exam_id, restaurant_id, user_id)
    where is_active = true;
