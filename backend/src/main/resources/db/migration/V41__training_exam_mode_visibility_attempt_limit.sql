alter table training_exam
    add column if not exists mode varchar(20) not null default 'CERTIFICATION',
    add column if not exists attempt_limit int;

alter table training_exam
    drop constraint if exists chk_training_exam_mode;

alter table training_exam
    add constraint chk_training_exam_mode check (mode in ('CERTIFICATION', 'PRACTICE'));

create table if not exists training_exam_visibility (
    exam_id bigint not null,
    position_id bigint not null,
    constraint uq_training_exam_visibility unique (exam_id, position_id),
    constraint fk_training_exam_visibility_exam
        foreign key (exam_id) references training_exam(id) on delete cascade,
    constraint fk_training_exam_visibility_position
        foreign key (position_id) references position(id)
);

create index if not exists idx_training_exam_visibility_exam_id
    on training_exam_visibility(exam_id);

create index if not exists idx_training_exam_visibility_position_id
    on training_exam_visibility(position_id);
