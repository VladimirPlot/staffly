CREATE TABLE training_knowledge_item (
    id BIGINT PRIMARY KEY, restaurant_id BIGINT NOT NULL,
    title TEXT NOT NULL, image_url TEXT, is_active BOOLEAN NOT NULL
);
INSERT INTO training_knowledge_item VALUES (1, 10, 'Existing card', 'old-photo', false);
