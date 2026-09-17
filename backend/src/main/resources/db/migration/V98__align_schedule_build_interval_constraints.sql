alter table schedule_build_position_config
    drop constraint chk_sbpc_work_period_interval;

alter table schedule_build_shift_option
    drop constraint chk_sbso_interval,
    add constraint chk_sbso_interval check (start_time <> end_time);

alter table schedule_build_coverage_rule
    drop constraint chk_sbcr_interval,
    add constraint chk_sbcr_interval check (start_time <> end_time);
