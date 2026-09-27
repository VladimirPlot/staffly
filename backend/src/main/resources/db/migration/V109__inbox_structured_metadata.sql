alter table inbox_messages
    add column metadata jsonb not null default '{}'::jsonb;
