alter table schedule
    add column if not exists preference_all_submitted_notified_at timestamptz;
