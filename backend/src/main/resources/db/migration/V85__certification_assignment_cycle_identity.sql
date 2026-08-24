-- A specification may be referenced by many independently-launched global cycles.
alter table certification_assessment_specification
    add constraint uq_certification_specification_exam_identity unique (id, exam_id);

create table certification_assignment_cycle (
    id bigserial primary key,
    exam_id bigint not null references training_exam(id),
    assessment_specification_id bigint not null,
    cycle_sequence int not null check (cycle_sequence > 0),
    kind varchar(24) not null check (kind in ('VERSION_PUBLICATION', 'RE_CERTIFICATION')),
    launched_at timestamptz not null default now(),
    launched_by_id bigint references users(id) on delete set null,
    constraint uq_certification_assignment_cycle_exam_sequence unique (exam_id, cycle_sequence),
    constraint fk_certification_cycle_specification_exam
        foreign key (assessment_specification_id, exam_id)
        references certification_assessment_specification(id, exam_id)
);

create index idx_certification_assignment_cycle_specification
    on certification_assignment_cycle(assessment_specification_id);

alter table training_exam_assignment
    add column assignment_cycle_id bigint references certification_assignment_cycle(id),
    add column deactivation_reason varchar(32),
    add column replaced_by_assignment_id bigint references training_exam_assignment(id),
    add constraint chk_training_exam_assignment_deactivation_reason check (
        deactivation_reason is null or deactivation_reason in (
            'AUDIENCE_REMOVED', 'EXAM_HIDDEN', 'USER_RESET',
            'RE_CERTIFICATION_CYCLE', 'SUPERSEDED_BY_VERSION'
        )
    ),
    add constraint chk_training_exam_assignment_not_self_replaced check (
        replaced_by_assignment_id is null or replaced_by_assignment_id <> id
    );

create index idx_training_exam_assignment_cycle on training_exam_assignment(assignment_cycle_id);
create index idx_training_exam_assignment_replacement on training_exam_assignment(replaced_by_assignment_id);

-- Preserve V84 integrity only for unclassified history. It must not prevent two cycles
-- for the same specification/version from each starting at personal generation zero.
drop index uq_training_exam_assignment_cycle_generation;
create unique index uq_training_exam_assignment_legacy_generation
    on training_exam_assignment(exam_id, user_id, exam_version_snapshot, reset_generation)
    where assignment_cycle_id is null;
create unique index uq_training_exam_assignment_cycle_user_generation
    on training_exam_assignment(assignment_cycle_id, user_id, reset_generation)
    where assignment_cycle_id is not null;

-- Notification behavior remains on the legacy exam-scoped table. This separate table
-- is ready for one milestone projection per integrated cycle without ambiguous backfill.
create table certification_assignment_cycle_notification_state (
    assignment_cycle_id bigint primary key references certification_assignment_cycle(id),
    last_completed_milestone int not null default 0 check (last_completed_milestone >= 0),
    updated_at timestamptz not null default now()
);
