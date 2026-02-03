create table if not exists user_dashboard_layout (
    id bigserial primary key,
    user_id bigint not null,
    restaurant_id bigint not null,
    layout jsonb not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint fk_user_dashboard_layout_user foreign key (user_id) references users (id),
    constraint fk_user_dashboard_layout_restaurant foreign key (restaurant_id) references restaurants (id),
    constraint uq_user_dashboard_layout unique (user_id, restaurant_id)
);

create index if not exists idx_user_dashboard_layout_restaurant
    on user_dashboard_layout (restaurant_id);