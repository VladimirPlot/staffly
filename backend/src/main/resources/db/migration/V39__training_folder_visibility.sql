create table if not exists training_folder_visibility (
    folder_id bigint not null,
    position_id bigint not null,
    constraint uq_training_folder_visibility unique (folder_id, position_id),
    constraint fk_training_folder_visibility_folder
        foreign key (folder_id) references training_folder(id) on delete cascade,
    constraint fk_training_folder_visibility_position
        foreign key (position_id) references position(id)
);

create index if not exists idx_training_folder_visibility_folder_id
    on training_folder_visibility(folder_id);

create index if not exists idx_training_folder_visibility_position_id
    on training_folder_visibility(position_id);