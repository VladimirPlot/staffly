alter table training_folder add column target_role varchar(20);

-- Preserve folder IDs, sources, assignments and published versions. A legacy tree
-- receives its highest assessed level, including hidden folders/exams. This never
-- grants a lower-level preparer access to a formerly protected scope.
with recursive tree as (
    select id as root_id, id from training_folder
    where parent_id is null and type in ('QUESTION_BANK', 'CERTIFICATION')
    union all
    select tree.root_id, child.id from tree
    join training_folder child on child.parent_id = tree.id
), levels as (
    select tree.root_id, case p.level when 'ADMIN' then 3 when 'MANAGER' then 2 else 1 end as rank
    from tree join training_folder_visibility v on v.folder_id = tree.id
    join position p on p.id = v.position_id
    union all
    select tree.root_id, case p.level when 'ADMIN' then 3 when 'MANAGER' then 2 else 1 end
    from tree join training_exam e on e.folder_id = tree.id and e.mode = 'CERTIFICATION'
    join training_exam_visibility v on v.exam_id = e.id
    join position p on p.id = v.position_id
), roles as (
    select roots.root_id, case coalesce(levels.rank, 1)
        when 3 then 'ADMIN' when 2 then 'MANAGER' else 'STAFF' end as role
    from (select distinct root_id from tree) roots
    left join (select root_id, max(rank) as rank from levels group by root_id) levels
        on levels.root_id = roots.root_id
)
update training_folder f set target_role = roles.role
from tree join roles on roles.root_id = tree.root_id where f.id = tree.id;

alter table training_folder add constraint chk_training_folder_target_role check (
    (type = 'KNOWLEDGE' and target_role is null)
    or (type in ('QUESTION_BANK', 'CERTIFICATION') and target_role in ('STAFF', 'MANAGER', 'ADMIN') and target_role is not null)
);

delete from training_folder_visibility v using training_folder f
where v.folder_id = f.id and f.type in ('QUESTION_BANK', 'CERTIFICATION');
