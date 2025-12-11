create table anonymous_letter (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id),
    sender_id bigint not null references users(id),
    recipient_member_id bigint not null references restaurant_member(id),
    subject varchar(50) not null,
    content text not null,
    created_at timestamp with time zone not null default now(),
    read_at timestamp with time zone
);

create index idx_anonymous_letter_restaurant on anonymous_letter(restaurant_id);
create index idx_anonymous_letter_recipient on anonymous_letter(recipient_member_id);
create index idx_anonymous_letter_sender_created on anonymous_letter(sender_id, created_at);