alter table schedule_preference_cell
    add constraint uq_schedule_preference_cell_submission_day
    unique (submission_id, day);
