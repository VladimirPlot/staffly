alter table schedule_cell
    add column source varchar(32) not null default 'MANUAL';

alter table schedule_cell
    add constraint chk_schedule_cell_source
        check (source in ('MANUAL', 'PREFERENCE_HINT', 'AUTO_BUILD'));
