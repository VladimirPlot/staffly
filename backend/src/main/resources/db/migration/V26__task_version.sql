alter table task
    add column version bigint not null default 0;