alter table schedule_preference_cell
    drop constraint if exists chk_schedule_pref_cell_time;

alter table schedule_preference_cell
    add constraint chk_schedule_pref_cell_time check (
        (full_day = true and start_time is null and end_time is null)
        or
        (
            full_day = false
            and start_time is not null
            and end_time is not null
            and start_time <> end_time
            and (start_time < end_time or end_time = time '00:00')
        )
    );
