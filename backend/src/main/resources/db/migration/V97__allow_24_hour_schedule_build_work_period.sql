alter table schedule_build_position_config
    drop constraint chk_sbpc_full_shift_interval;

alter table schedule_build_position_config
    add constraint chk_sbpc_work_period_interval check (
        work_period_start = work_period_end
        or (
            work_period_start <> work_period_end
            and (work_period_end = time '00:00:00' or work_period_start < work_period_end)
        )
    );
