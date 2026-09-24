create table schedule_build_weekday_regime (
    id bigserial primary key,
    position_config_id bigint not null references schedule_build_position_config(id) on delete cascade,
    work_period_start time not null,
    work_period_end time not null,
    sort_order integer not null default 0,
    constraint chk_sbwdr_work_period check (work_period_start <> work_period_end or work_period_start = time '00:00:00')
);
create index idx_sbwdr_position_config on schedule_build_weekday_regime(position_config_id);

create table schedule_build_weekday_regime_day (
    weekday_regime_id bigint not null references schedule_build_weekday_regime(id) on delete cascade,
    day_of_week varchar(9) not null,
    constraint uq_sbwdrd_regime_day unique (weekday_regime_id, day_of_week),
    constraint chk_sbwdrd_day check (day_of_week in
        ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'))
);
create index idx_sbwdrd_regime on schedule_build_weekday_regime_day(weekday_regime_id);

-- Preserve every existing block as one semantically equivalent all-week regime.
insert into schedule_build_weekday_regime(position_config_id, work_period_start, work_period_end, sort_order)
select id, work_period_start, work_period_end, 0 from schedule_build_position_config;

insert into schedule_build_weekday_regime_day(weekday_regime_id, day_of_week)
select regime.id, day_name
from schedule_build_weekday_regime regime
cross join (values ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
                   ('FRIDAY'), ('SATURDAY'), ('SUNDAY')) weekdays(day_name);

alter table schedule_build_shift_option add column weekday_regime_id bigint;
update schedule_build_shift_option option
set weekday_regime_id = regime.id
from schedule_build_weekday_regime regime
where regime.position_config_id = option.position_config_id;
alter table schedule_build_shift_option alter column weekday_regime_id set not null;
alter table schedule_build_shift_option add constraint fk_sbso_weekday_regime
    foreign key (weekday_regime_id) references schedule_build_weekday_regime(id) on delete cascade;

alter table schedule_build_coverage_rule add column weekday_regime_id bigint;
update schedule_build_coverage_rule rule
set weekday_regime_id = regime.id
from schedule_build_weekday_regime regime
where regime.position_config_id = rule.position_config_id;
alter table schedule_build_coverage_rule alter column weekday_regime_id set not null;
alter table schedule_build_coverage_rule add constraint fk_sbcr_weekday_regime
    foreign key (weekday_regime_id) references schedule_build_weekday_regime(id) on delete cascade;

alter table schedule_build_coverage_date_override add column weekday_regime_id bigint;
update schedule_build_coverage_date_override override_row
set weekday_regime_id = regime.id
from schedule_build_weekday_regime regime
where regime.position_config_id = override_row.position_config_id;
alter table schedule_build_coverage_date_override alter column weekday_regime_id set not null;
alter table schedule_build_coverage_date_override add constraint fk_sbcdo_weekday_regime
    foreign key (weekday_regime_id) references schedule_build_weekday_regime(id) on delete cascade;

alter table schedule_build_coverage_date_override drop constraint uq_sbcdo_config_date_shift;
alter table schedule_build_coverage_date_override add constraint uq_sbcdo_regime_date_shift
    unique (weekday_regime_id, date, shift_option_id);

drop index if exists idx_sbso_position_config;
drop index if exists idx_sbcr_position_config;
drop index if exists idx_sbcdo_position_config;
create index idx_sbso_weekday_regime on schedule_build_shift_option(weekday_regime_id);
create index idx_sbcr_weekday_regime on schedule_build_coverage_rule(weekday_regime_id);
create index idx_sbcdo_weekday_regime on schedule_build_coverage_date_override(weekday_regime_id);

alter table schedule_build_shift_option drop column position_config_id;
alter table schedule_build_coverage_rule drop column position_config_id;
alter table schedule_build_coverage_date_override drop column position_config_id;
alter table schedule_build_position_config drop constraint chk_sbpc_work_period_interval;
alter table schedule_build_position_config drop column work_period_start;
alter table schedule_build_position_config drop column work_period_end;
