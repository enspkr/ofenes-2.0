-- 000001_initial_schema.up.sql
-- Creates all tables for the ofenes application.

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member', 'viewer')),
    display_name  TEXT,
    avatar_url    TEXT,
    status        TEXT NOT NULL DEFAULT 'offline'
                      CHECK (status IN ('online', 'offline', 'away', 'busy')),
    bio           TEXT,
    preferences   JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE rooms (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    type         TEXT NOT NULL DEFAULT 'public'
                     CHECK (type IN ('public', 'private', 'direct')),
    created_by   UUID NOT NULL REFERENCES users(id),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    video_state  JSONB NOT NULL DEFAULT '{"url":"","playing":false,"timestamp":0}',
    max_members  INT NOT NULL DEFAULT 50,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_created_by ON rooms (created_by);
CREATE INDEX idx_rooms_active ON rooms (is_active) WHERE is_active = true;

-- ============================================================
-- ROOM MEMBERS (many-to-many)
-- ============================================================
CREATE TABLE room_members (
    room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'moderator', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members (user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id  UUID NOT NULL REFERENCES users(id),
    type       TEXT NOT NULL DEFAULT 'chat'
                   CHECK (type IN ('chat', 'system', 'video_sync', 'admin')),
    content    TEXT NOT NULL,
    metadata   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_room_created ON messages (room_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages (sender_id);

-- ============================================================
-- MEDIA SESSIONS (video calls, screen shares)
-- ============================================================
CREATE TABLE media_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('video_call', 'screen_share', 'audio_call')),
    started_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at   TIMESTAMPTZ,
    metadata   JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_media_sessions_room ON media_sessions (room_id, started_at DESC);
CREATE INDEX idx_media_sessions_active ON media_sessions (room_id) WHERE ended_at IS NULL;

-- ============================================================
-- MEDIA SESSION PARTICIPANTS
-- ============================================================
CREATE TABLE media_session_participants (
    session_id UUID NOT NULL REFERENCES media_sessions(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at    TIMESTAMPTZ,
    PRIMARY KEY (session_id, user_id, joined_at)
);

CREATE INDEX idx_media_participants_user ON media_session_participants (user_id);

-- ============================================================
-- SHARED FILES
-- ============================================================
CREATE TABLE shared_files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    uploaded_by  UUID NOT NULL REFERENCES users(id),
    file_name    TEXT NOT NULL,
    file_size    BIGINT NOT NULL,
    mime_type    TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    message_id   UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_files_room ON shared_files (room_id, created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_rooms
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
