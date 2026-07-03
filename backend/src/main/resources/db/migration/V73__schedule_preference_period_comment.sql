alter table schedule_preference_submission
    add column if not exists period_comment text;

update schedule_preference_submission
set period_comment = comment
where period_comment is null
  and comment is not null;
