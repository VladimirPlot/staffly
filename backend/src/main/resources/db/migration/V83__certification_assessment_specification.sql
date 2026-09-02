create table certification_assessment_specification (
    id bigserial primary key,
    exam_id bigint not null references training_exam(id) on delete cascade,
    version int not null,
    question_count int not null check (question_count > 0),
    pass_percent int not null check (pass_percent between 0 and 100),
    time_limit_sec int,
    attempt_limit int,
    created_at timestamptz not null default now(),
    constraint uq_certification_specification_exam_version unique (exam_id, version),
    constraint uq_certification_specification_identity unique (id, exam_id, version),
    constraint chk_certification_specification_limits check (
        (time_limit_sec is null or time_limit_sec > 0)
        and (attempt_limit is null or attempt_limit > 0)
    )
);

create table certification_assessment_folder_source (
    id bigserial primary key,
    specification_id bigint not null references certification_assessment_specification(id) on delete cascade,
    folder_id bigint not null references training_folder(id),
    pick_mode varchar(20) not null check (pick_mode in ('ALL', 'RANDOM')),
    random_count int,
    constraint uq_certification_assessment_folder unique (specification_id, folder_id),
    constraint chk_certification_assessment_folder_random check (
        (pick_mode = 'ALL' and random_count is null)
        or (pick_mode = 'RANDOM' and random_count > 0)
    )
);

create table certification_assessment_question_source (
    id bigserial primary key,
    specification_id bigint not null references certification_assessment_specification(id) on delete cascade,
    question_id bigint not null references training_question(id),
    constraint uq_certification_assessment_question unique (specification_id, question_id)
);

-- Backfill only the current business cycle of existing Certification exams.
insert into certification_assessment_specification
    (exam_id, version, question_count, pass_percent, time_limit_sec, attempt_limit, created_at)
select id, version, question_count, pass_percent, time_limit_sec, attempt_limit, coalesce(updated_at, created_at, now())
from training_exam
where mode = 'CERTIFICATION'
on conflict (exam_id, version) do nothing;

-- Older in-place assignment cycles may still be retained. Their original rules were not
-- persisted before 7G.1, so preserve linkage with the only safe legacy approximation:
-- the current projection. New attempts never use this fallback for newly-created cycles.
insert into certification_assessment_specification
    (exam_id, version, question_count, pass_percent, time_limit_sec, attempt_limit, created_at)
select distinct exam.id, assignment.exam_version_snapshot, exam.question_count, exam.pass_percent,
       exam.time_limit_sec, assignment.attempts_limit_snapshot, assignment.assigned_at
from training_exam_assignment assignment
join training_exam exam on exam.id = assignment.exam_id and exam.mode = 'CERTIFICATION'
on conflict (exam_id, version) do nothing;

insert into certification_assessment_folder_source (specification_id, folder_id, pick_mode, random_count)
select specification.id, source.folder_id, source.pick_mode, source.random_count
from certification_assessment_specification specification
join training_exam_source_folder source on source.exam_id = specification.exam_id
on conflict (specification_id, folder_id) do nothing;

insert into certification_assessment_question_source (specification_id, question_id)
select specification.id, source.question_id
from certification_assessment_specification specification
join training_exam_source_question source on source.exam_id = specification.exam_id
on conflict (specification_id, question_id) do nothing;

alter table training_exam_assignment add column assessment_specification_id bigint;

update training_exam_assignment assignment
set assessment_specification_id = specification.id
from certification_assessment_specification specification
where specification.exam_id = assignment.exam_id
  and specification.version = assignment.exam_version_snapshot;

alter table training_exam_assignment alter column assessment_specification_id set not null;
alter table training_exam_assignment
    add constraint fk_assignment_certification_specification
    foreign key (assessment_specification_id, exam_id, exam_version_snapshot)
    references certification_assessment_specification(id, exam_id, version);

-- Hibernate @Immutable protects application writes; this trigger also rejects direct SQL mutation.
create function reject_certification_specification_update() returns trigger language plpgsql as $$
begin
    raise exception 'Certification assessment specifications are immutable';
end $$;

create trigger certification_specification_no_update
before update on certification_assessment_specification
for each row execute function reject_certification_specification_update();
create trigger certification_folder_source_no_update
before update on certification_assessment_folder_source
for each row execute function reject_certification_specification_update();
create trigger certification_question_source_no_update
before update on certification_assessment_question_source
for each row execute function reject_certification_specification_update();

-- Prevent specifications for Practice while allowing cascading exam deletion.
create function enforce_certification_specification_exam() returns trigger language plpgsql as $$
begin
    if not exists (select 1 from training_exam where id = new.exam_id and mode = 'CERTIFICATION') then
        raise exception 'Assessment specifications belong to Certification exams only';
    end if;
    return new;
end $$;
create trigger certification_specification_exam_only
before insert on certification_assessment_specification
for each row execute function enforce_certification_specification_exam();
