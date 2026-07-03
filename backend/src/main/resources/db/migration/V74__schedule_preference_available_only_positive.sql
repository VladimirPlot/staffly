update schedule_preference_cell
set type = 'AVAILABLE'
where type = 'PREFER_WORK';

alter table schedule_preference_cell
    drop constraint if exists chk_schedule_pref_cell_type;

alter table schedule_preference_cell
    add constraint chk_schedule_pref_cell_type check (type in ('AVAILABLE','UNAVAILABLE','PREFER_DAY_OFF'));
