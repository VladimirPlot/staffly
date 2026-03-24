alter table training_exam_assignment
    add column if not exists exam_version_snapshot int;

update training_exam_assignment a
set exam_version_snapshot = e.version
from training_exam e
where a.exam_id = e.id
  and a.exam_version_snapshot is null;

alter table training_exam_assignment
    alter column exam_version_snapshot set not null;