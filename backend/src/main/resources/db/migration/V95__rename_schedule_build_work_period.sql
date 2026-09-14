alter table schedule_build_position_config
    rename column full_shift_start to work_period_start;

alter table schedule_build_position_config
    rename column full_shift_end to work_period_end;
