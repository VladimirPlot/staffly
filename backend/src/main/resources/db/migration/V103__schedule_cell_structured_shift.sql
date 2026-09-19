alter table schedule_cell
    add column shift_start_time time,
    add column shift_start_day_offset integer,
    add column shift_end_time time,
    add column shift_end_day_offset integer,
    add constraint chk_schedule_cell_structured_shift_complete check (
        (shift_start_time is null and shift_start_day_offset is null
            and shift_end_time is null and shift_end_day_offset is null)
        or
        (shift_start_time is not null and shift_start_day_offset between 0 and 1
            and shift_end_time is not null and shift_end_day_offset between 0 and 1
            and (shift_end_day_offset * 1440
                + extract(hour from shift_end_time)::integer * 60
                + extract(minute from shift_end_time)::integer)
              > (shift_start_day_offset * 1440
                + extract(hour from shift_start_time)::integer * 60
                + extract(minute from shift_start_time)::integer))
    );

comment on column schedule_cell.shift_start_time is
    'Authoritative structured shift interval; all four shift columns are null for non-shift/legacy cells';
