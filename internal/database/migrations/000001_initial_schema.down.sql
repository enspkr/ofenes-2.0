-- 000001_initial_schema.down.sql
-- Drops all tables in reverse dependency order.

DROP TRIGGER IF EXISTS set_updated_at_rooms ON rooms;
DROP TRIGGER IF EXISTS set_updated_at_users ON users;
DROP FUNCTION IF EXISTS trigger_set_updated_at();

DROP TABLE IF EXISTS shared_files;
DROP TABLE IF EXISTS media_session_participants;
DROP TABLE IF EXISTS media_sessions;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
