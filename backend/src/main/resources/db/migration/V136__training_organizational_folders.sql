alter table training_folder add column organizational boolean not null default false;
alter table training_folder drop constraint chk_training_folder_target_role;
alter table training_folder add constraint chk_training_folder_target_role check (
    (type = 'KNOWLEDGE' and target_role is null and organizational = false)
    or (type in ('QUESTION_BANK', 'CERTIFICATION') and (
        (organizational = true and target_role is null)
        or (organizational = false and target_role is not null and target_role in ('STAFF', 'MANAGER', 'ADMIN'))
    ))
);
