create table if not exists training_exam_assignment (
    id bigserial primary key,
    exam_id bigint not null,
    restaurant_id bigint not null,
    user_id bigint not null,
    assigned_position_id bigint,
    assigned_at timestamptz not null default now(),
    attempts_limit_snapshot int,
    extra_attempts int not null default 0,
    attempts_used int not null default 0,
    best_score int,
    last_attempt_at timestamptz,
    passed_at timestamptz,
    status varchar(20) not null default 'ASSIGNED',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_training_exam_assignment_exam
        foreign key (exam_id) references training_exam(id) on delete cascade,
    constraint fk_training_exam_assignment_restaurant
        foreign key (restaurant_id) references restaurant(id) on delete cascade,
    constraint fk_training_exam_assignment_user
        foreign key (user_id) references users(id) on delete cascade,
    constraint fk_training_exam_assignment_position
        foreign key (assigned_position_id) references position(id),
    constraint chk_training_exam_assignment_status
        check (status in ('ASSIGNED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'EXHAUSTED', 'ARCHIVED')),
    constraint chk_training_exam_assignment_non_negative
        check (extra_attempts >= 0 and attempts_used >= 0)
);

create index if not exists idx_training_exam_assignment_exam_id
    on training_exam_assignment(exam_id);
create index if not exists idx_training_exam_assignment_restaurant_user
    on training_exam_assignment(restaurant_id, user_id);
create index if not exists idx_training_exam_assignment_active
    on training_exam_assignment(is_active);
create unique index if not exists uq_training_exam_assignment_active_scope
    on training_exam_assignment(exam_id, restaurant_id, user_id)
    where is_active = true;

alter table training_exam_attempt
    add column if not exists assignment_id bigint;

alter table training_exam_attempt
    drop constraint if exists fk_training_exam_attempt_assignment;

alter table training_exam_attempt
    add constraint fk_training_exam_attempt_assignment
        foreign key (assignment_id) references training_exam_assignment(id);

create index if not exists idx_training_exam_attempt_assignment_id
    on training_exam_attempt(assignment_id);