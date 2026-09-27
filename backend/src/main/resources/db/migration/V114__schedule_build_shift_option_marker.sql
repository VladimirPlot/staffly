alter table schedule_build_shift_option
    add column marker_id bigint null;

alter table schedule_build_shift_option
    add constraint fk_sbso_marker
        foreign key (marker_id) references schedule_build_marker(id) on delete set null;

create index idx_sbso_marker on schedule_build_shift_option(marker_id);
