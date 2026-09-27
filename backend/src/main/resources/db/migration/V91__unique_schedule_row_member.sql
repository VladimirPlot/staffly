alter table schedule_row
    add constraint uq_schedule_row_schedule_member unique (schedule_id, member_id);
