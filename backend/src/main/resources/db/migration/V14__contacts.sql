create table contacts (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id),
    name varchar(200) not null,
    description text,
    phone varchar(100) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_contacts_restaurant on contacts (restaurant_id);