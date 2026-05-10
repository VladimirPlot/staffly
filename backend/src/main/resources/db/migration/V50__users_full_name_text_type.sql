DO $$
DECLARE
    full_name_data_type text;
BEGIN
    SELECT data_type
    INTO full_name_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'full_name';

    IF full_name_data_type = 'bytea' THEN
        ALTER TABLE users
            ALTER COLUMN full_name TYPE VARCHAR(70)
            USING convert_from(full_name, 'UTF8');
    END IF;
END $$;