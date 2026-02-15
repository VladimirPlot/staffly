create index if not exists idx_checklist_restaurant_kind_name
    on checklist (restaurant_id, kind, name);
