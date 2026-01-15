create table task (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    title varchar(200) not null,
    description text,
    priority varchar(10) not null,
    due_date date,
    status varchar(20) not null,
    completed_at timestamp,
    assigned_user_id bigint references users(id) on delete set null,
    assigned_position_id bigint references position(id) on delete set null,
    assigned_to_all boolean not null default false,
    created_by_id bigint references users(id) on delete set null,
    created_at timestamp not null default now(),
    deleted_at timestamp
);

create index idx_task_restaurant on task(restaurant_id);
create index idx_task_assigned_user on task(assigned_user_id);
create index idx_task_assigned_position on task(assigned_position_id);
create index idx_task_status on task(status);
create index idx_task_due_date on task(due_date);

create table task_comment (
    id bigserial primary key,
    task_id bigint not null references task(id) on delete cascade,
    author_id bigint not null references users(id) on delete cascade,
    text text not null,
    created_at timestamp not null default now()
);

create index idx_task_comment_task on task_comment(task_id);
create index idx_task_comment_author on task_comment(author_id);