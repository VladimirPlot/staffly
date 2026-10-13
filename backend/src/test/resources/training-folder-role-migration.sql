-- Run with psql -v ON_ERROR_STOP=1 -f this-file against a disposable database.
-- Temporary tables isolate the fixture; ROLLBACK leaves no data or schema behind.
begin;
create temp table position (id bigint primary key, level varchar(20));
create temp table training_folder (id bigint primary key, parent_id bigint, type varchar(30), is_active boolean);
create temp table training_folder_visibility (folder_id bigint, position_id bigint);
create temp table training_exam (id bigint primary key, folder_id bigint, mode varchar(30));
create temp table training_exam_visibility (exam_id bigint, position_id bigint);

insert into position values (11, 'STAFF'), (12, 'MANAGER'), (13, 'ADMIN');
insert into training_folder values
    (1, null, 'KNOWLEDGE', true),
    (2, null, 'QUESTION_BANK', true),
    (3, null, 'QUESTION_BANK', true), (4, 3, 'QUESTION_BANK', false),
    (5, null, 'CERTIFICATION', true), (6, 5, 'CERTIFICATION', true),
    (7, null, 'CERTIFICATION', true);
insert into training_folder_visibility values (1, 11), (3, 11), (3, 12), (4, 13), (7, 12);
insert into training_exam values (100, 5, 'CERTIFICATION'), (101, 6, 'CERTIFICATION');
insert into training_exam_visibility values (100, 11), (101, 13);

\ir ../../main/resources/db/migration/V135__training_folder_target_role.sql

do $$
begin
    if (select count(*) from training_folder) <> 7 then raise exception 'Folder IDs changed'; end if;
    if exists (select 1 from training_folder where
        (id = 1 and target_role is not null)
        or (id = 2 and target_role <> 'STAFF')
        or (id in (3,4,5,6) and target_role <> 'ADMIN')
        or (id = 7 and target_role <> 'MANAGER')) then raise exception 'Incorrect assessed role'; end if;
    if (select count(*) from training_folder_visibility) <> 1
        or not exists (select 1 from training_folder_visibility where folder_id = 1 and position_id = 11)
        then raise exception 'Knowledge visibility changed or management visibility retained'; end if;
    if (select count(*) from training_exam_visibility) <> 2
        or not exists (select 1 from training_exam_visibility where exam_id = 100 and position_id = 11)
        or not exists (select 1 from training_exam_visibility where exam_id = 101 and position_id = 13)
        then raise exception 'Existing assessment audiences changed'; end if;
    begin
        insert into training_folder values (8, null, 'QUESTION_BANK', true, null);
        raise exception 'Missing management role accepted';
    exception when check_violation then null; end;
    begin
        update training_folder set target_role = 'ADMIN' where id = 1;
        raise exception 'Knowledge role accepted';
    exception when check_violation then null; end;
end $$;
rollback;
