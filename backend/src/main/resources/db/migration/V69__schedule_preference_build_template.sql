alter table schedule
    add column if not exists preference_build_template_id bigint;

alter table schedule
    add constraint fk_schedule_preference_build_template
        foreign key (preference_build_template_id) references schedule_build_template(id)
        on delete set null;

create index if not exists idx_schedule_preference_build_template
    on schedule(preference_build_template_id);
